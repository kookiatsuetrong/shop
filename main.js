// download project from https://github.com/kookiatsuetrong/shop
// npm install express ejs mysql
var express = require('express')
var server  = express()
server.listen(2000)
var source  = {host:'localhost', database:'web',
               user:'james',     password:'bond'}
var mysql   = require('mysql')
var pool    = mysql.createPool(source)
var ejs     = require('ejs')
server.engine('html', ejs.renderFile) // set EJS to default view engine
var readBody = express.urlencoded({extended:false})

server.get([ '/', '/home' ], showHome)
server.get('/browse', showAll)
server.get('/test', showTest)
server.get('/result', showSearchResult)
server.get('/detail', showDetail)
server.get (['/join','/register'], showRegisterPage)
server.post(['/join','/register'], readBody, saveNewMember)

server.use( express.static('public') )
server.use( showError )

// 1. sensitive information -> HTTP POST
// 2. HTTP Post in Express must be read by middleware
// 3. the data will be availble at req.body
function saveNewMember(req, res) {
    var sql = 'insert into member(email,password,name)' +
              '  values(?, sha2(?,512), ?)'
    var data = [req.body.email,req.body.password,req.body.name]
    pool.query(sql, data, function(error, result) {
        var model = { }
        if (error == null) {
            model.message = 'Register Success'
        } else {
            model.message = 'Fail to register'
        }
        res.render('register-result.html', model) // <%= message %>
    })
}

function showRegisterPage(req, res) {
    res.render('register.html')
}

// localhost:2000/detail?code=7
function showDetail(req,res) {
    var sql  = 'select * from post where code=?'
    var info = [ req.query.code, 'welcome', 3 ]
    pool.query(sql, info, function(error, data) {
        var model = { }
        if (data.length == 1) {
            model.data = data[0]
        } else {
            model.data = {topic: 'Not Found', detail:''}
        }
        var sql1 = 'select * from photo where post=?'
        pool.query(sql1, info, function(error, image) {
            model.image = image
            res.render('detail.html', model)
        })
    })  // <%= data.topic %>  <%= data.detail %>
}

function showError(req, res, next) {
    res.render('error.html')
}

function showHome(req, res) {
    res.render('index.html')
}
// Search Exactly: select * from post where topic=Cheap City Car
// Search Similar: select * from post where topic like '%car%'
// Search from multiple columns: ... where topic like '%car%' or detail like '%car%' 
function showSearchResult(req, res) {
    var data = [ '%'+req.query.product+'%', '%'+req.query.product+'%' ]
    var sql = 'select * from post where topic like ? or detail like ?'
    pool.query(sql, data, function (error, data) {
        var model = { }
        model.all = data
        res.render('result.html', model)
    })
}
// var data = [ req.body.email, req.body.password, req.body.name]
// var sql  = 'insert into member(email, password, name) values(?,sha2(?,512),?)'
// pool.query(sql, data, function)

function showAll(req, res) {
    pool.query('select * from post', function(error, data) {
        var model = { }
        model.all = data
        res.render('browse.html', model)
    })
}
function showTest(req, res) {
    pool.query('select * from post', function(error, data) {
        res.send(data)
    })
}