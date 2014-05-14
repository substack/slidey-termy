#!/usr/bin/env node

var http = require('http');
var fs = require('fs');
var path = require('path');
var marked = require('marked');
var shoe = require('shoe');
var shux = require('shux')();
var muxDemux = require('mux-demux');
var spawn = require('child_process').spawn;
var minimist = require('minimist');

var argv = minimist(process.argv.slice(2), {
    alias: { d: 'debug', v: 'verbose', p: 'port' },
    boolean: [ 'debug', 'verbose' ]
});

var clear = new Buffer([ 0x1b, 0x5b, 0x48, 0x1b, 0x5b, 0x32, 0x4a ]);

var os = require('os');
var mkdirp = require('mkdirp');
var tmpdir = path.join(os.tmpdir(), '');
var bundleFile = path.join(tmpdir, 'bundle-' + Math.random() + '.js');
mkdirp.sync(tmpdir);

var slideFile = path.resolve(argv._[0]);
fs.writeFileSync(tmpdir + '/slides.markdown', fs.readFileSync(slideFile));

var port = parseInt(argv.port || argv._[1] || 8000);
console.log('http://127.0.0.1:' + port);

var cwd = process.cwd();
process.chdir(tmpdir);

var ecstatic = require('ecstatic')(path.dirname(slideFile));
var args = [ __dirname + '/../browser.js', '-o', bundleFile ];
if (argv.debug) args.push('-d');
if (argv.verbose) args.push('-v');
args.push('-t', require.resolve('brfs'));
spawn('watchify', args, { stdio: [ 'ignore', process.stderr, process.stderr ] });

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
        res.setHeader('content-type', 'text/javascript');
        var s = fs.createReadStream(bundleFile)
        s.on('error', function (err) { res.end(err + '\n') });
        return s.pipe(res);
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
