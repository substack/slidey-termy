var fs = require('fs');
var path = require('path');
var marked = require('marked');
var shoe = require('shoe');
var exterminate = require('exterminate');

var sock = shoe('/sock');
var muxDemux = require('mux-demux');

var mx = muxDemux();
mx.on('connection', function (stream) {
    if (stream.meta.type !== 'cwd') return;
    var basedir = stream.meta.cwd;
    queue.forEach(function (ref) {
        var img = ref[0], ix = ref[1];
        
        var alt = JSON.parse(img.getAttribute('alt'));
        var dir = path.resolve(basedir, alt.cwd);
        var sh = createShell(ix, dir);
        sh.appendTo('#slides');
        var size = getSize();
        sh.resize(size.width, size.height);
    });
});

sock.pipe(mx).pipe(sock);

var slideIndex;
var terminals = {};
var slides = [];
var queue = [];
var activeTerm;

var src = fs.readFileSync(process.env.MARKDOWN_FILE, 'utf8');
(function (html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    
    var current = [];
    [].forEach.call(div.querySelectorAll('*'), function (elem, ix) {
        if (elem.tagName === 'H1') {
            if (current.length) createSlide(current);
            current = [];
        }
        current.push(elem);
    });
    if (current.length) createSlide(current);
    
})(marked(src));

show(0);

function createSlide (elems) {
    var slide = document.createElement('div');
    slide.classList.add('slide');
    
    var images = document.createElement('div');
    images.classList.add('images');
    
    var text = document.createElement('div');
    text.classList.add('text');
    
    slide.appendChild(images);
    slide.appendChild(text);
    
    slide.style.backgroundColor = 'rgb(63,63,63)';
    
    document.querySelector('#slides').appendChild(slide);
    slides.push(slide);
    
    elems.forEach(function (elem) {
        if (elem.tagName === 'IMG') {
            var src = elem.getAttribute('src');
            if (/^{/.test(elem.getAttribute('alt'))) {
                queue.push([ elem, ix ]);
            }
            images.appendChild(elem);
            function onresize () {
                text.style.left = elem.offsetLeft + 20;
                text.style.right = window.innerWidth
                    - (elem.offsetLeft + elem.width) + 20
                ;
            }
            setTimeout(onresize, 100);
            window.addEventListener('resize', onresize);
    
        }
        else {
            text.appendChild(elem);
        }
    });
    
    return slide;
}

function show (n) {
    if (n >= slides.length) n = slides.length - 1;
    if (n < 0) n = 0;
    var prev = document.querySelector('.slide.show');
    if (prev) prev.classList.remove('show');
    slides[n].classList.add('show');
    
    if (activeTerm) activeTerm.terminal.element.classList.remove('show');
    activeTerm = terminals[n];
    
    if (activeTerm) activeTerm.terminal.element.classList.add('show');
    slideIndex = n;
}

function createShell (n, cwd) {
    var term = exterminate(80, 25);
    var sh = mx.createStream({
        command: [ 'bash', '-i' ],
        cwd: cwd,
        columns: 120,
        rows:35 
    });
    sh.write('clear\n');
    
    term.pipe(sh).pipe(term);
    terminals[n] = term;
    
    function resize () {
        var size = getSize();
        term.resize(size.width, size.height);
        term.terminal.element.style.left = (window.innerWidth - size.width) / 2;
        term.terminal.element.style.width = size.width;
    }
    resize();
    window.addEventListener('resize', resize);
    return term;
}

function getSize () {
    var h = parseInt(window.innerHeight);
    return {
        height: h - 150,
        width: h * 4 / 3 - 200
    };
}

window.addEventListener('keydown', function (ev) {
    if (ev.keyIdentifier === 'Right') {
        show(slideIndex + 1);
    }
    else if (ev.keyIdentifier === 'Left') {
        show(slideIndex - 1);
    }
    if (!activeTerm) return;
    activeTerm.terminal.keyDown(ev);
});

window.addEventListener('keypress', function (ev) {
    if (!activeTerm) return;
    activeTerm.terminal.keyPress(ev);
});

var clock = document.querySelector('#clock');
var interval;
clock.addEventListener('click', function (ev) {
    if (interval) clearInterval(interval);
    var start = Date.now();
    interval = setInterval(function () {
        var elapsed = Date.now() - start;
        var m = Math.floor(elapsed / 1000 / 60);
        var s = Math.floor(elapsed / 1000 % 60);
        var mm = (m < 10 ? '0' : '') + m;
        var ss = (s < 10 ? '0' : '') + s;
        clock.textContent = mm + ':' + ss;
    }, 1000);
});
