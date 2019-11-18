var sharp = require('sharp')
var a = ['test/calculus.pdf', 'test/lis.jpg']
var count = 0
for (var i in a) {
  var image = sharp(a[i])
              .resize({width:1800, height: 1800,
                       withoutEnlargement:true})
              .toFile(a[i]+'.jpg')
              .then(e => console.log(e))
              .catch(e=>{})
              .finally(e=>{
                count++
                if (count == a.length) {
                  console.log('Finish')
                }
              })
}


//.toFile('test/calculus.jpg')
//.catch(function() { })
