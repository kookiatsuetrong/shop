// download project from https://github.com/kookiatsuetrong/shop
// npm install express ejs mysql cookie-parser sharp multer
var fs      = require('fs')
var express = require('express')
var server  = express()    // create server
server.listen(80)
var source  = { host:'localhost', database:'web',
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

server.get ([ '/', '/home' ], showHome)
server.get ('/browse',  showAll)
server.get ('/test',    showTest)
server.get ('/result',  showSearchResult)
server.get ('/detail',  showDetail)
server.get (['/join','/register'],  showRegisterPage)
server.post(['/join','/register'],  readBody, saveNewMember)
server.get ('/login',   showLogInPage)
server.post('/login',   readBody,   checkPassword)
server.get ('/profile', readCookie, showProfilePage)
server.get ('/logout',  readCookie, logOutMember)
server.get ('/post',    readCookie, showPostPage)
server.post('/post',    readCookie, upload.array('photo'), convert, postMessage)

server.use( express.static('public') )
server.use( showError )

// file ที่ผู้ใช้ upload ขี้นมา อาจจะเป็นรูปภาพหรือไม่ใช่รูปภาพ อาจจะเป็น png, jpg หรืออื่นๆ 
// ดังนั้น file ที่ผู้ใช้ upload เข้ามา ต้องแปลง file ให้เป็นมาตรฐานเดียวกัน นั่นคือต้องทำ 3 อย่าง
// 1. convert photo ในเว็บนี้คือ .jpg ไม่เกิน 640x640 pixel
// เช่น ผู้ใช้ upload มา 4 files ตัว multer จะสร้าง temporary file ให้ 4 files
// จากนั้นใช้ sharp ลองแปลงให้เป็น file มาตรฐานเดียวกัน ถ้าแปลงได้จะได้ .jpg เป็น file ใหม่
// และต้องเก็บชื่อ .jpg ที่ได้มา ลง array ไว้ด้วย ชื่อ req.photo เพื่อให้ function ถัดไปเอาไปใช้งาน
// ถ้าแปลงไม่ได้นั่นก็คือไม่ใช่รูปภาพ อาจจะเป็นข้อมูลอย่างอื่นที่ถูกส่งเข้ามา
// 2. remove temporary ลบ file ชั่วคราวทิ้งไปหมดเลย 
// 3. insert photo เอาชื่อ file ที่แปลงแล้วใส่ database ถ้าอันไหนที่ไม่ใช่รูปภาพก็จะไม่มีข้อมูล

function convert(req, res, next) {
	req.photo = [ ] // สร้าง array ขึ้นมาเพื่อเก็บเฉพาะรูปภาพ
	var count = 0
	req.files.map(function(file) {
		sharp('public/' + file.filename) // 1. แปลงรูปภาพเป็น .jpg ที่มีขนาดเล็กลง
		.resize({width:640, height:640,
				fit:'inside', withoutEnlargement:true})
		.toFile('public/' + file.filename + '.jpg', function(e,r) {
			if (e == null) { // แปลงแล้วไม่มี error ต้องเก็บชื่อ file ไว้ด้วย
				req.photo.push(file.filename + '.jpg')
			}
			// 2. ลบ file ชั่วคราวทิ้งไปให้หมด
			fs.unlink('public/' + file.filename, function() { 
				count++
				if (count == req.files.length) {
					next() // call the next function
				}
			})
		})
	})
}

function postMessage(req, res) {
	var card = req.cookies ? req.cookies.card : null
	if (valid[card]) {
		var sql  = 'insert into post(topic,detail,`member`) ' +
					' values(?,?,?)'
		var data = [req.body.topic, req.body.detail, 
					valid[card].code ]
		pool.query(sql, data, function(error, result) {
			var count = 0
			for (var file of req.photo) {
				// 3. file ใน req.photo คือรูปภาพ ต้องเก็บใน database
				var sql  = 'insert into photo(path, post) values(?,?)'          
				var data = [file, result.insertId]
				pool.query(sql, data, function() {
					count++
					if (count == req.photo.length) {
						res.redirect('/detail?code=' + result.insertId)
					}
				})
			}
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
	var sql  = 'select * from `member` where ' +
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
	var sql = 'insert into `member`(email,password,name)' +
				'  values(?, sha2(?,512), ?)'
	var data = [req.body.email, req.body.password, req.body.name]
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
		model.product = req.query.product
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
