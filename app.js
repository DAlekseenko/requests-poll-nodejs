const async = require("async")
const request = require('request');
const http = require("http");

const HOST = '127.0.0.1'
const PORT = '8080'
const PROTOCOL = 'http://'

let requests = [
    {
        name: "getUser", // уникальный идентификатор запроса
        url: "/get-user", // url
        method: "GET", // HTTP метод
        important: true,
        params: {
            id: "id"
        }
    },
    {
        name: "getAddressCoordinate",
        url: "/get-address-coordinate",
        method: "POST",
        important: false,
        params: {
            id: "getUser.id", // уникальный_идентификатор_запроса.название_поля
            name: "getUser.name", // уникальный_идентификатор_запроса.название_поля
        }
    },
    {
        name: "getUsersFriend",
        url: "/get-users-friend",
        method: "POST",
        important: true,
        params: {
            id: "id"
        }
    },
    {
        name: "getBestFriend",
        url: "/get-best-friend",
        method: "GET",
        important: false,
        params: {
            id: "getUsersFriend.bestfriend_id"
        }
    }
]

const [, , id] = process.argv // entrance

const entryParams = {
    id
}



function prepareRequest(listOfHttpMethods) {
    const numTasks = listOfHttpMethods.length;
    if(!numTasks) {
        throw Error("method list is Empty")
    }
    listOfHttpMethods = requests.reduce((acc, request) => {

        if (!http.METHODS.includes(request.method)) {
            throw Error("incorrect http method")
        }
        const dependencies = Object.values(request.params).reduce((acc, cur) => {
            const [method, key] = cur.split('.')
            if (key && method) {
                acc.add(method)
            }
            return acc
        }, new Set())
        acc.set(request.name, {dependencies, request})
        return acc

    }, new Map())


    const uncheckedDependencies = {}
    const readyToCheck = []
    listOfHttpMethods.forEach(item => {

        item.dependencies.forEach(method => {
            if (!listOfHttpMethods.has(method)) {
                throw Error(`method ${method} for dependency not found`)
            }
        })
        if(!item.dependencies.size) {
            readyToCheck.push(item.request.name);
        }
        uncheckedDependencies[item.request.name] = item.dependencies.size;
    })

    function checkForDeadlocks() {
        let currentTask;
        let counter = 0;
        while (readyToCheck.length) {
            currentTask = readyToCheck.pop();
            counter++;
            getDependents(currentTask).forEach(dependent => {
                if (--uncheckedDependencies[dependent] === 0) {
                    readyToCheck.push(dependent);
                }
            });
        }
        if (counter !== numTasks) {
            throw new Error(
                'failed validate tasks due to a recursive dependency'
            );
        }
    }

    function getDependents(taskName) {
        const result = [];

        listOfHttpMethods.forEach(({dependencies, request}) => {
            if (dependencies.has(taskName)) {
                result.push(request.name);
            }
        });
        return result;
    }
    checkForDeadlocks()

    return listOfHttpMethods;
}

const executeRequest = (toExecute, callback) => {

    const {method, url, important, params} = toExecute

    const options = {
        url: `${PROTOCOL}${HOST}:${PORT}${url}`,
        method,
        json: true,
    }

    if (method === "POST") {
        options.body = params
    }
    if (method === "GET") {
        options.qs = params
    }

    request(options, (error, response, body) => {

        if (!error && response.statusCode !== 200) {
            error = http.STATUS_CODES[response.statusCode]
        }
        if (error) {
            callback(important ? error : null, null)
            return
        }
        callback(null, body)
    })
}


const callback = (request) => (callback) => {
    const toExecute = {...request}
    for (let k in toExecute.params) {
        if (entryParams[k]) {
            toExecute.params[k] = entryParams[k]
        }
    }
    executeRequest(toExecute, callback);
}

const callbackWithDependencies = (request) => (results, callback) => {
    const toExecute = {...request}

    for (let k in request.params) {
        const [method, key] = request.params[k].split('.')
        console.warn(method, key, results)
        if (!results[method] || !results[method][key]) {
            if (request.important) {
                callback(`Param ${key} for ${request.name} not found in response`, null)
            } else {
                callback(null, null)
            }
            return
        }
        request.params[k] = results[method][key]
    }

    executeRequest(toExecute, callback);
}

function generateTasks(listOfHttpMethods) {

    const requests = prepareRequest(listOfHttpMethods)
    const tasks = {}

    requests.forEach(item => {
        if (!!item.dependencies.size) {
            tasks[item.request.name] = [...item.dependencies, callbackWithDependencies(item.request)]
        } else {
            tasks[item.request.name] = callback(item.request)
        }

    })

    return tasks;
}

function runRequest(tasks) {
    return async.auto(tasks)
}

const tasks = generateTasks(requests)

runRequest(tasks)
    .then(console.dir)
    .catch(console.error)

