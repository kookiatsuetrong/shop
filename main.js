var express = require('express')
var server  = express()
server.listen(2000)
var source  = {host:'localhost', database:'web',
               user:'james',     password:'bond'}
var mysql   = require('mysql')
var pool    = mysql.createPool(source)
var ejs     = require('ejs')
server.engine('html', ejs.renderFile) // set EJS to default view engine
server.get('/', showHome)
server.get('/browse', showAll)
server.get('/test', showTest)
server.get('/result', showSearchResult)

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