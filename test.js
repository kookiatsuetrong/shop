var sharp = require('sharp')
var image = sharp('test/calculus.pdf').toFile('test/calculus.jpg')
            .catch(function() { })