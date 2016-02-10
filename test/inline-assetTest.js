
var assert = require('chai').assert
var bluebird = require('bluebird')
var path = require('path')
var fs = require('fs')
bluebird.promisifyAll(fs)

var InlineAsset = require('../lib/inline-asset')

function testInlineWithFixture(inliner, fixtureRelPath, done) {
    var filePath = path.join(__dirname, fixtureRelPath)
    var fileDir = path.dirname(filePath)
    var fileExt = path.extname(filePath)
    var fileName = path.basename(filePath, fileExt)

    var expectedFileName = fileName + '_inlined' + fileExt
    var expectedFilePath = path.join(fileDir, expectedFileName)

    console.log(filePath)
    console.log(expectedFilePath)

    bluebird.props({
        expected: fs.readFileAsync(expectedFilePath, { encoding: 'utf-8' }),
        actual: inliner.inlineAssetsAsync(filePath)
    }).then(function(result) {
        //console.log(result.actual)
        //console.log(result.expected)
        assert.equal(result.actual.trim(), result.expected.trim())
        done()
    }).catch(function(err) {
        done(err)
    })
}

describe('inline-asset', function() {

    describe('css', function() {
        it('inlines a simple css file', function(done) {
            var inliner = new InlineAsset()
            testInlineWithFixture(inliner, 'fixtures/css_01.html', done)
        })

        it('inlines a simple css file with cssmin', function(done) {
            var inliner = new InlineAsset({ cssmin: true })
            testInlineWithFixture(inliner, 'fixtures/css_02_min.html', done)
        })

        it('does not inline css without inline tag', function(done) {
            var inliner = new InlineAsset({ cssmin: true })
            testInlineWithFixture(inliner, 'fixtures/css_03_noinline.html', done)
        })
    })

    describe('javascript', function() {
        it('inlines a simple js file', function(done) {
            var inliner = new InlineAsset()
            testInlineWithFixture(inliner, 'fixtures/js_01.html', done)
        })

        it('inlines a simple js file with uglify', function(done) {
            var inliner = new InlineAsset({ uglify: true })
            testInlineWithFixture(inliner, 'fixtures/js_02_uglify.html', done)
        })

        it('does not inline js without inline tag', function(done) {
            var inliner = new InlineAsset({ uglify: true })
            testInlineWithFixture(inliner, 'fixtures/js_03_noinline.html', done)
        })
    })

    describe('images', function() {
        it('inlines a simple png file', function(done) {
            var inliner = new InlineAsset()
            testInlineWithFixture(inliner, 'fixtures/img_01.html', done)
        })

        it('does not inline without inline tag', function(done) {
            var inliner = new InlineAsset()
            testInlineWithFixture(inliner, 'fixtures/img_02_noinline.html', done)
        })
    })
})
