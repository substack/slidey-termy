#!/usr/bin/env node

var http = require('http');
var fs = require('fs');
var path = require('path');
var marked = require('marked');
var shoe = require('shoe');
var shux = require('shux')();
var muxDemux = require('mux-demux');
var spawn = require('child_process').spawn;
var browserify = require('browserify');

var clear = new Buffer([ 0x1b, 0x5b, 0x48, 0x1b, 0x5b, 0x32, 0x4a ]);

var os = require('os');
var mkdirp = require('mkdirp');
var tmpdir = path.join(os.tmpdir(), '');
mkdirp.sync(tmpdir);

var slideFile = path.resolve(process.argv[2]);
fs.writeFileSync(tmpdir + '/slides.markdown', fs.readFileSync(slideFile));

var port = parseInt(process.argv[3] || 8000);
console.log('http://127.0.0.1:' + port);

var cwd = process.cwd();
process.chdir(tmpdir);

var ecstatic = require('ecstatic')(path.dirname(slideFile));

var server = http.createServer(function (req, res) {
    if (req.url === '/') {
        res.setHeader('content-type', 'text/html');
        fs.createReadStream(__dirname + '/../static/index.html').pipe(res);
        return;
    }
    else if (req.url === '/slides') {
        var ondata = function (err, src) {
            if (err) return res.end(err + '\n');
            res.setHeader('content-type', 'text/html');
            res.end(marked(src))
        };
        fs.readFile(slideFile, 'utf8', ondata);
        return;
    }
    else if (req.url === '/bundle.js') {
        var b = browserify(__dirname + '/../browser.js');
        b.transform('brfs');
        b.bundle().pipe(res);
        return;
    }
    
    if (/^\/static\//.test(req.url)) {
        req.url = req.url.replace(/^\/static/, '');
    }
    ecstatic(req, res);
});
server.listen(8000, '127.0.0.1');

var sock = shoe(function (stream) {
    var mx = muxDemux(function (mstream) {
        mstream.pipe(shux.createShell(mstream.meta)).pipe(mstream);
    });
    stream.pipe(mx).pipe(stream);
    mx.createReadStream({ type: 'cwd', cwd: cwd });
});
sock.install(server, '/sock');
