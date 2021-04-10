const async = require("async")
const request = require('request');
const http = require("http");

const HOST = '127.0.0.1'
const PORT = '8080'

let requests = [
    {
        name: "getUser", // уникальный идентификатор запроса
        url: "/get-user", // url
        method: "GET", // HTTP метод
        important: true,
        params: [
            "id",
        ]
    },
    {
        name: "getAddressCoordinate",
        url: "/get-address-coordinate",
        method: "POST",
        important: false,
        params: [
            "getUser.id", // уникальный_идентификатор_запроса.название_поля
            "getUser.name", // уникальный_идентификатор_запроса.название_поля
        ]
    },
    {
        name: "getUsersFriend",
        url: "/get-users-friend",
        method: "POST",
        important: true,
        params: [
            "id",
        ]
    },
    {
        name: "getBestFriend",
        url: "/get-best-friend",
        method: "GET",
        important: false,
        params: [
            "getUsersFriend.bestfriend_id"
        ]
    }
]

requests = requests.reduce((acc, cur) => {
    if (!http.METHODS.includes(cur.method)) {
        throw Error("incorrect http method")
    }
    const dependencies = cur.params.reduce((acc, cur) => {
        if (!cur) {
            return acc
        }
        const [method, key] = cur.split('.')
        if (key && method) {
            acc.add(method)
        }
        return acc
    }, new Set())

    acc.set(cur.name, {dependencies, request: cur})
    return acc
}, new Map())


requests.forEach(request => {
    if (request.params) {
        request.dependencies.forEach(method => {
            if (!requests.has(method)) {
                throw Error("method for dependency not found")
            }
        })
    }
})


const [, , id] = process.argv

async.auto({
    getUser: function (callback) {

        const {method, url, important} = requests.get('getUser').request

        const requestUrl = `http://${HOST}:${PORT}${url}/${id}`

        request({
            url: requestUrl,
            method,
            json: true,
        }, function (error, response, body) {

            if (!error && response.statusCode !== 200) {
                error = http.STATUS_CODES[response.statusCode]
            }

            if (error) {
                callback(important ? error : null, null)
                return
            }

            if (!body.id || !body.name) {
                callback('method getUser, invalid response', null)
            }

            callback(null, body)
        });
    },
    getAddressCoordinate: ['getUser', function (results, callback) {
        const {method, url, important} = requests.get('getAddressCoordinate').request
        const {name, id} = results.getUser
        const body = {id, name}


        const requestUrl = `http://${HOST}:${PORT}${url}`

        request({
            url: requestUrl,
            method,
            json: true,
            body
        }, function (error, response, body) {

            if (!error && response.statusCode !== 200) {
                error = http.STATUS_CODES[response.statusCode]
            }

            if (error) {
                callback(important ? error : null, null)
                return
            }

            callback(null, body)
        });
    }],
    getUsersFriend: function (callback) {
        const {method, url, important} = requests.get('getUsersFriend').request
        const body = {id}

        const requestUrl = `http://${HOST}:${PORT}${url}`

        request({
            url: requestUrl,
            method,
            json: true,
            body
        }, function (error, response, body) {

            if (!error && response.statusCode !== 200) {
                error = http.STATUS_CODES[response.statusCode]
            }

            if (error) {
                callback(important ? error : null, null)
                return
            }

            if (!body.bestfriend_id) {
                callback('method getUsersFriend, invalid response', null)
            }

            callback(null, body)
        });
    },
    getBestFriend: ['getUsersFriend', function (results, callback) {

        console.log('getBestFriend', results)

        const {method, url, important} = requests.get('getBestFriend').request

        const {bestfriend_id} = results.getUsersFriend

        const requestUrl = `http://${HOST}:${PORT}${url}/${bestfriend_id}`

        request({
            url: requestUrl,
            method,
            json: true,
        }, function (error, response, body) {

            if (!error && response.statusCode !== 200) {
                error = http.STATUS_CODES[response.statusCode]
            }

            if (error) {
                callback(important ? error : null, null)
                return
            }

            callback(null, body)
        })

    }]
}, function (err, results) {
    console.log('error = ', err);
    if(err){
        console.log('error = ', err);
        return
    }
    console.log('results = ', results);
    return results;
})

