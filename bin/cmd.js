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

var port = parseInt(argv.port || argv._[1] || 8000);
console.log('http://127.0.0.1:' + port);

var cwd = process.cwd();
process.chdir(tmpdir);

var ecstatic = require('ecstatic');
var slidest = ecstatic(path.dirname(slideFile));
var st = ecstatic(__dirname + '/../static');

var args = [ __dirname + '/../browser.js', '-o', bundleFile ];
if (argv.debug) args.push('-d');
if (argv.verbose) args.push('-v');
args.push('-t', require.resolve('envify'));
args.push('-t', require.resolve('brfs'));

var watchbin = path.join(
    path.dirname(require.resolve('watchify')),
    'bin/cmd.js'
);
args.unshift(watchbin);

var ps = spawn(process.execPath, args, { env: { MARKDOWN_FILE: slideFile } });
ps.stderr.pipe(process.stderr);
ps.stdout.pipe(process.stdout);

var server = http.createServer(function (req, res) {
    if (req.url === '/' || req.url === '/style.css') {
        return st(req, res);
    }
    else if (/\/\d+\//.test(req.url)) {
        req.url = '/';
        return st(req, res);
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
        (function retry (attempts) {
            var s = fs.createReadStream(bundleFile);
            s.once('error', function (err) {
                if (attempts === 25) res.end(err + '\n')
                else setTimeout(retry, 250);
            });
            s.pipe(res);
        })(0);
        return;
    }
    
    if (/^\/static\//.test(req.url)) {
        req.url = req.url.replace(/^\/static/, '');
    }
    slidest(req, res);
});
server.listen(port, '127.0.0.1');

var sock = shoe(function (stream) {
    var mx = muxDemux(function (mstream) {
        mstream.pipe(shux.createShell(mstream.meta)).pipe(mstream);
    });
    stream.pipe(mx).pipe(stream);
    mx.createReadStream({ type: 'cwd', cwd: cwd });
});
sock.install(server, '/sock');
