// download project from https://github.com/kookiatsuetrong/shop
// npm install express ejs mysql cookie-parser sharp multer
var express = require('express')
var server  = express()    // create server
server.listen(80)
var source  = {host:'localhost', database:'web',
               user:'james',     password:'bond'}
var mysql   = require('mysql')
var pool    = mysql.createPool(source)
var ejs     = require('ejs')
var parser  = require('cookie-parser') // load module
var readCookie = parser()              // create parser
var sharp   = require('sharp')
var multer  = require('multer')
var upload  = multer({dest:'public'})  // all uploaded files to public folder
server.engine('html', ejs.renderFile)  // set EJS to default view engine
var readBody = express.urlencoded({extended:false}) // true for accepting array
var valid = [ ]

server.get([ '/', '/home' ], showHome)
server.get('/browse', showAll)
server.get('/test', showTest)
server.get('/result', showSearchResult)
server.get('/detail', showDetail)
server.get (['/join','/register'], showRegisterPage)
server.post(['/join','/register'], readBody, saveNewMember)
server.get ('/login', showLogInPage)
server.post('/login', readBody, checkPassword)
server.get ('/profile', readCookie, showProfilePage)
server.get ('/logout', readCookie, logOutMember)
server.get ('/post', readCookie, showPostPage)
server.post('/post', readCookie, upload.array('photo'), postMessage)

server.use( express.static('public') )
server.use( showError )

var fs = require('fs')

// ภาพที่ผู้ใช้ Upload เข้ามาต้องทำ 3 อย่าง คือ
// 1. convertPhoto() แปลงให้เป็นมาตรฐานเดียวกัน ในเว็บนี้คือ .jpg ไม่เกิน 640x640 pixel
// 2. removePhoto() ลบ File เดิมทิ้งไป ถ้าอันไหนที่ไม่ใช่รูปภาพจะถูกตัดทิ้งไป
// 3. insertPhoto() เอาชื่อ File ที่แปลงแล้วใส่ Database
function convertPhoto(req, res, id) {
    var count = 0
    for (var i in req.files) {
        var photo = sharp(  'public/' + req.files[i].filename)
                    .resize({width:640,height:640,withoutEnlargement:true})
                    .toFile('public/' + req.files[i].filename + '.jpg')
                    .catch( function() { } )
                    .finally( function() {
                        count++
                        if (count == req.files.length) {
                            removePhoto(req, res, id)
                        }
                    })
    }
}

function removePhoto(req, res, id) {
    var count = 0
    for (var i in req.files) {
        fs.unlink('public/' + req.files[i].filename, function() {
            count++
            if (count == req.files.length) {
                insertPhoto(req, res, id)
            }
        })
    }
}

function insertPhoto(req, res, id) {
    for (var i in req.files) {
        var file = req.files[i].filename + '.jpg'
        try {
        if (fs.statSync('public/' + file)) {
            var sql  = 'insert into photo(path, post) values(?,?)'          
            var data = [file, id]
            pool.query(sql, data, function(e,r) {})
	}
        } catch (e) { }
    }       
    res.redirect('/detail?code=' + id)
}

function postMessage(req, res) {
    var card = req.cookies ? req.cookies.card : null
    if (valid[card]) {
        var sql  = 'insert into post(topic,detail,member) ' +
                '  values(?,?,?) '
        var data = [req.body.topic, req.body.detail, 
                    valid[card].code ]
        pool.query(sql, data, function(error, result) {
            convertPhoto(req, res, result.insertId)
        })
    } else {
        res.redirect('/login')
    }
}

function showPostPage(req, res) {
    var card = req.cookies ? req.cookies.card : null
    if (valid[card]) {
        var model = { member: valid[card] }
        res.render('post.html', model)
    } else {
        res.redirect('/login')
    }
}

function logOutMember(req, res) {
    var card = req.cookies ? req.cookies.card : null
    delete valid[card]
    res.render('logout.html') 
}

function showProfilePage(req, res) {
    var card = null    // เริ่มให้ card เป็น null
    if (req.cookies != null) card = req.cookies.card
    // ถ้า req.cookies มีข้อมูล ให้เปลี่ยนค่า card

    // var card = req.cookies ? req.cookies.card : null
    // req.cookies มีค่าหรือเปล่า ถ้ามีใช้ค่า req.cookies.card 
    //             ถ้าไม่มี ใช้ค่า null
    if (valid[card]) {
        var model = { }
        model.user = valid[card] // เอาข้อมูลผู้ใช้ไปแสดงผลด้วย
        res.render('profile.html', model) // Hello <%= user.name %>
    } else {
        res.redirect('/login')
        // res.render('login.html') // Will cause error
    }
}

function checkPassword(req, res) {
    var sql  = 'select * from member where ' +
               '  email=? and password=sha2(?,512) '
    var data = [ req.body.email, req.body.password ]
    pool.query(sql, data, function(error, result) {
        if (result.length == 1) {
            var card = randomCard()
            valid[card] = result[0] // user information
            res.header('Set-Cookie', 'card='+card+';HttpOnly')
            res.redirect('/profile')
        } else {
            res.redirect('/login')
        }
    })
}

function randomCard() {
    var a = [ ]
    for (var i = 0; i < 8; i++) {
        var r = parseInt( Math.random() * 10000 )
        if (r < 1000) r = '0'   + r
        if (r <  100) r = '00'  + r
        if (r <   10) r = '000' + r
        a.push(r)
    }
    return a.join('-')
}

function showLogInPage(req, res) {
    res.render('login.html')
}

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
