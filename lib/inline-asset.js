var _ = require('lodash')
var bluebird = require('bluebird')
var path = require('path')
var fs = require('fs')
var datauri = require('datauri')
var UglifyJS = require('uglify-js')
var CleanCSS = require('clean-css')

var defaultOptions = {
    tag: '__inline',
    uglify: false,
    cssmin: false
}

function InlineAsset(config) {
    bluebird.promisifyAll(this)
    this.config = _.defaults(config, defaultOptions)
}

_.extend(InlineAsset.prototype, {
    inlineAssets: function inlineAssets(filePath, done) {
        //fs.createReadStream(filePath, { flags: 'r' })
        //    .pipe(es.split())

        var options = this.config
        var fileType = path.extname(filePath).replace(/^\./, '')

        if (!fs.existsSync(filePath)) {
            return done(new Error('file does not exist: ' + filePath))
        }
        var fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' })
        console.log('Processing ' + filePath + '...')

        if (fileType === 'html') {
            fileContent = html(filePath, fileContent, undefined, options)
        } else if (fileType === 'css') {
            fileContent = css(filePath, fileContent, undefined, options)
        } else {
            return done(new Error('invalid file type: ' + fileType))
        }

        done(null, fileContent)
    }
})

_.extend(InlineAsset, {})

function isPathAbsolute() {
    var filePath = path.join.apply(path, arguments)
    return filePath.charAt(0) === '/'
}

/*
 * Majority of the below code is adopted from the grunt-inline project
 * in order to free it from it's dependency on grunt
 * https://github.com/chyingp/grunt-inline/blob/master/tasks/inline.js
 */
function isRemotePath(url) {
    return url.match(/^'?https?:\/\//) || url.match(/^\/\//)
}

function isBase64Path(url) {
    return url.match(/^'?data.*base64/)
}

function html(filePath, fileContent, relativeTo, options) {
    if (relativeTo) {
        filePath = filePath.replace(/[^\/]+\//, relativeTo)
    }

    fileContent = fileContent.replace(/<inline.+?src=["']([^"']+?)["']\s*?\/>/g, function (matchedWord, src) {
        var ret = matchedWord

        if (isRemotePath(src) || !isPathAbsolute(src)) {

            var inlineFilePath = path.resolve(path.dirname(filePath), src)
            if (fs.existsSync(inlineFilePath)) {
                ret = fs.readFileSync(inlineFilePath, { encoding: 'utf-8' })

                // @otod need to be checked, add bye herbert
                var _more = src.match(/^(..\/)+/ig)
                if (_more = _more && _more[0]) {
                    var _addMore = function () {
                        var _ret = arguments[0], _src = arguments[2]
                        if (!_src.match(/^http\:\/\//)) {
                            _ret = arguments[1] + _more + arguments[2] + arguments[3]
                            console.log('inline > ' + _ret)
                        }
                        return _ret
                    }
                    ret = ret.replace(/(<script.+?src=["'])([^"']+?)(["'].*?><\/script>)/g, _addMore)
                }
            } else {
                console.log("ERROR: Couldn't find " + inlineFilePath + '!')
            }
        }

        return ret
    }).replace(/<script.+?src=["']([^"']+?)["'].*?>\s*<\/script>/g, function (matchedWord, src) {
        var ret = matchedWord

        if (!isRemotePath(src) && src.indexOf(options.tag) !== -1) {
            var inlineFilePath = path.resolve(path.dirname(filePath), src).replace(/\?.*$/, '')
            var c = options.uglify ? UglifyJS.minify(inlineFilePath).code : fs.readFileSync(inlineFilePath, { encoding: 'utf-8' })
            if (fs.existsSync(inlineFilePath)) {
                ret = '<script>\n' + c.trim() + '\n</script>'
            } else {
                console.log("ERROR: Couldn't find " + inlineFilePath + '!')
            }
        }
        console.log('ret = : ' + ret + '\n')

        return ret

    }).replace(/<link.+?href=["']([^"']+?)["'].*?\/?>/g, function (matchedWord, src) {
        var ret = matchedWord

        if (!isRemotePath(src) && src.indexOf(options.tag) !== -1) {

            var inlineFilePath = path.resolve(path.dirname(filePath), src).replace(/\?.*$/, '')

            if (fs.existsSync(inlineFilePath)) {
                var styleSheetContent = fs.readFileSync(inlineFilePath, { encoding: 'utf-8' })
                ret = '<style>\n' + cssInlineToHtml(filePath, inlineFilePath, styleSheetContent, relativeTo, options).trim() + '\n</style>'
            } else {
                console.log("ERROR: Couldn't find " + inlineFilePath + '!')
            }
        }
        console.log('ret = : ' + ret + '\n')

        return ret
    }).replace(/<img.+?src=["']([^"':]+?)["'].*?\/?\s*?>/g, function (matchedWord, src) {
        var ret = matchedWord

        if (!isPathAbsolute(src) && src.indexOf(options.tag) !== -1) {

            var inlineFilePath = path.resolve(path.dirname(filePath), src).replace(/\?.*$/, '')

            if (fs.existsSync(inlineFilePath)) {
                ret = matchedWord.replace(src, (new datauri(inlineFilePath)).content)
            } else {
                console.log("ERROR: Couldn't find " + inlineFilePath + '!')
            }
        }
        console.log('ret = : ' + ret + '\n')

        return ret
    })

    return fileContent
}

function css(filePath, fileContent, relativeTo, options) {
    if (relativeTo) {
        filePath = filePath.replace(/[^\/]+\//g, relativeTo)
    }

    fileContent = fileContent.replace(/url\(["']*([^)'"]+)["']*\)/g, function (matchedWord, imgUrl) {
        var newUrl = imgUrl
        var flag = (imgUrl.indexOf(options.tag) !== -1)	// urls like "img/bg.png?__inline" will be transformed to base64
        if (isBase64Path(imgUrl) || isRemotePath(imgUrl)) {
            return matchedWord
        }
        console.log('imgUrl: ' + imgUrl)
        console.log('filePath: ' + filePath)
        var absoluteImgurl = path.resolve(path.dirname(filePath), imgUrl)
        console.log('absoluteImgurl: ' + absoluteImgurl)
        newUrl = path.relative(path.dirname(filePath), absoluteImgurl)
        console.log('newUrl: ' + newUrl)

        absoluteImgurl = absoluteImgurl.replace(/\?.*$/, '')
        if (flag && fs.existsSync(absoluteImgurl)) {
            newUrl = datauri(absoluteImgurl)
        } else {
            newUrl = newUrl.replace(/\\/g, '/')
        }

        return matchedWord.replace(imgUrl, newUrl)
    })
    fileContent = options.cssmin ? new CleanCSS().minify(fileContent).styles : fileContent

    return fileContent
}

function cssInlineToHtml(htmlFilepath, filePath, fileContent, relativeTo, options) {
    if (relativeTo) {
        filePath = filePath.replace(/[^\/]+\//g, relativeTo)
    }

    fileContent = fileContent.replace(/url\(["']*([^)'"]+)["']*\)/g, function (matchedWord, imgUrl) {
        var newUrl = imgUrl
        var flag = !!imgUrl.match(/\?__inline/)	// urls like "img/bg.png?__inline" will be transformed to base64
        console.log('flag:' + flag)
        if (isBase64Path(imgUrl) || isRemotePath(imgUrl)) {
            return matchedWord
        }
        console.log('imgUrl: ' + imgUrl)
        console.log('filePath: ' + filePath)
        var absoluteImgurl = path.resolve(path.dirname(filePath), imgUrl)	// img url relative to project root
        console.log('absoluteImgurl: ' + absoluteImgurl)
        newUrl = path.relative(path.dirname(htmlFilepath), absoluteImgurl)	// img url relative to the html file
        console.log([htmlFilepath, filePath, absoluteImgurl, imgUrl])
        console.log('newUrl: ' + newUrl)

        absoluteImgurl = absoluteImgurl.replace(/\?.*$/, '')
        if (flag && fs.existsSync(absoluteImgurl)) {
            newUrl = datauri(absoluteImgurl)
        } else {
            newUrl = newUrl.replace(/\\/g, '/')
        }

        return matchedWord.replace(imgUrl, newUrl)
    })
    fileContent = options.cssmin ? new CleanCSS().minify(fileContent).styles : fileContent

    return fileContent
}

module.exports = InlineAsset
