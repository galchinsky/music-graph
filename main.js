window.onload = function () {

var pi = Math.PI;

function timer(f, m)
{
    var target_time = (new Date()).getTime() + m;
    var margin = 3;

    setInterval(function(){
        var now = (new Date()).getTime();
        var dif = target_time - now;
        // If within acceptable timeframe, call function
        if (dif <= margin && dif >= -margin) {
            target_time = now + m + dif;
            f();
        }
        // For some reason we missed the time frame.
        // Skip and move on to next
        if (dif < -margin ) {
           target_time += m;
           //margin += 1;
        }
    },
    1);
}

function encodeAudio16bit(data, sampleRate) {
    var n = data.length;
    var integer = 0, i;
    
    // 16-bit mono WAVE header template
    var header = "RIFF<##>WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00<##><##>\x02\x00\x10\x00data<##>";

    // Helper to insert a 32-bit little endian int.
    function insertLong(value) {
        var bytes = "";
        for (i = 0; i < 4; ++i) {
            bytes += String.fromCharCode(value % 256);
            value = Math.floor(value / 256);
        }
        header = header.replace('<##>', bytes);
    }

    // ChunkSize
    insertLong(36 + n * 2);
    
    // SampleRate
    insertLong(sampleRate);

    // ByteRate
    insertLong(sampleRate * 2);

    // Subchunk2Size
    insertLong(n * 2);
    
    // Output sound data
    for (var i = 0; i < n; ++i) {
        var sample = Math.round(Math.min(1, Math.max(-1, data[i])) * 32767);
        if (sample < 0) {
            sample += 65536; // 2's complement signed
        }
        header += String.fromCharCode(sample % 256);
        header += String.fromCharCode(Math.floor(sample / 256));
    }
    
    return 'data:audio/wav;base64,' + btoa(header);
}

function drawSound(data) {
    var canvas = document.getElementById('plot');

    var l = data.length;
    var w = canvas.width;
    var h = canvas.height;
    //var data2 = constantLoPass(w/l, 0.7, 1)(data);

    var ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(0,h/2);
    for (var tIdx = 0; tIdx < l; ++tIdx) {
        ctx.lineTo(tIdx * w / l, (h + data[tIdx] * h * 0.9) / 2);
    }
    
    ctx.stroke();
    ctx.restore();
}

function sound(data, sampleRate) {
    var dataUri = encodeAudio16bit(data, sampleRate);
    //drawSound(data);
    playDataUri(dataUri);
}

function createAudio(dataUri) {
    var audio = document.createElement('audio');
    audio.setAttribute('src', dataUri);
    return audio;
}

function playDataUri(dataUri) {
    createAudio(dataUri).play();    
}



function noteNumberToFreq(midiNumber) {
    A4number = 57;
    return 440.0 * Math.pow(2, (midiNumber - A4number) / 12.0);
}

function generateAudioSample() {
    var data = [];
    for (var j = 0; j < 44100; ++j) {
        data.push(Math.sin(2 * pi * 55.0 * j / 44100.0));
    }
    //document.write(data);
    return data;
}

// Fx

function amplify(input, amp) {
    var l = input.length;
    var output = [];
    for (var tIdx = 0; tIdx < l; ++tIdx) {
        output.push( input[tIdx] * amp  );
    }
    return output;
}

function add(input, amp) {
    var l = input.length;
    var output = [];
    for (var tIdx = 0; tIdx < l; ++tIdx) {
        output.push( input[tIdx] + amp  );
    }
    return output;
}

function addArr(input, amp) {
    var l = input.length;
    var output = [];
    for (var tIdx = 0; tIdx < l; ++tIdx) {
        output.push( input[tIdx] + amp[tIdx]  );
    }
    return output;
}


function sub(input1, input2) {
    var l = input1.length;
    var output = [];
    for (var tIdx = 0; tIdx < l; ++tIdx) {
        output.push( input1[tIdx] - input2[tIdx] );
    }
    return output;    
}

function constantHiPass(f, r, sampleRate) {
    var c = Math.tan(pi * f / sampleRate);
    var a1 = 1.0 / (1.0 + r * c + c * c);
    var a2 = -2*a1;
    var a3 = a1;
    var b1 = 2.0 * ( c*c - 1.0) * a1;
    var b2 = ( 1.0 - r * c + c * c) * a1;

    var inP1 = 0;
    var inP2 = 0;
    var outP1 = 0;
    var outP2 = 0;

    return function(input) {
        var l = input.length;
        var output = [];
        for ( var i = 0; i < l; ++i) {
            out = a1 * input[i] + a2 * inP1 + a3 * inP2 - b1*outP1 - b2*outP2;
            outP2 = outP1;
            outP1 = out;
            inP2 = inP1;
            inP1 = input[i];          
            output.push(out);
        }
        return output;
    }  
}

function constantLoPass(f, r, sampleRate) {
    var c = 1.0 / Math.tan(pi * f / sampleRate);
    var a1 = 1.0 / (1.0 + r * c + c * c);
    var a2 = 2*a1;
    var a3 = a1;
    var b1 = 2.0 * ( 1.0 - c*c) * a1;
    var b2 = ( 1.0 - r * c + c * c) * a1;

    var inP1 = 0;
    var inP2 = 0;
    var outP1 = 0;
    var outP2 = 0;

    return function(input) {
        var l = input.length;
        var output = [];
        for ( var i = 0; i < l; ++i) {
            out = a1 * input[i] + a2 * inP1 + a3 * inP2 - b1*outP1 - b2*outP2;
            outP2 = outP1;
            outP1 = out;
            inP2 = inP1;
            inP1 = input[i];          
            output.push(out);
        }
        return output;
    }  
}

// Oscs

function oscHarm(time, freq, phase) {
    var l = time.length;
    var data = [];
    for (var tIdx = 0; tIdx < l; ++tIdx) {
        data.push( Math.sin(2 * pi * freq[tIdx] * time[tIdx] + phase[tIdx]) );
    }
    return data;
}

function oscSaw(time, freq, phase) {
    var l = time.length;
    var data = [];
    for (var tIdx = 0; tIdx < l; ++tIdx) {
        data.push( 2 * ((freq[tIdx] * time[tIdx] + phase[tIdx]) % 1)  - 1);
    }
    return data;
}

function oscUltimateSaw(time, freq, phase) {
    var l = time.length;
    var data = [];
    var sampleRate;
    for (var tIdx = 0; tIdx < l; ++tIdx) {
        if (tIdx != l - 1) {
            sampleRate = 1/(time[tIdx + 1] - time[tIdx]);
        }
        var val = 0;
        for (var k = 1; k * freq[tIdx] < sampleRate / 2; ++k) {
            val += 2 / pi * Math.pow(-1, k) * Math.sin(2 * pi * k * freq[tIdx] * time[tIdx] + phase[tIdx]) / k;
        }
        data.push( val );
    }
    return data;
}

function oscSquare(time, freq, phase, phaseShift) {
    var l = time.length;
    var data1 = oscSaw(time, freq, phase);
    var data2 = oscSaw(time, freq, addArr(phase, phaseShift));
    return sub(data1, data2);
}


function sequencerFreq(pattern, bpm, sampleRate) {
    time = [];
    freq = [];
    tickSize = 60.0 / bpm;
    samplePeriod = 1 / sampleRate;
    for (var noteIdx = 0; noteIdx < pattern.length; ++noteIdx) {
        var curFreq = pattern[noteIdx][0];
        for (var t = 0; t < tickSize * pattern[noteIdx][1]; t += samplePeriod) {
            time.push(t);
            freq.push(curFreq);
            //document.write(t);
        }
    }
    return {'time': time, 'freq': freq};
}

function sequencer(pattern, bpm, sampleRate) {
    var patternFreq = [];
    for (var i = 0; i < pattern.length; ++i) {
        if (pattern[i][0] == 0) {
            var curFreq = 0;
        } else {
            var curFreq = noteNumberToFreq(pattern[i][0]);
        }
        patternFreq.push([curFreq, pattern[i][1]]);
    }
    return sequencerFreq(patternFreq, bpm, sampleRate);
}

Array.prototype.replicate = function(count) {
    var l = this.length;
    var b = new Array();
    for(i=0; i<count; i++) {
        b = b.concat(this);
    }
    return b;
};

var hipass = constantHiPass(30, 0.7, 44100);



var seq = sequencer([[57-12, 2], [59-12, 2], [58-12, 2], [58-12, 2]].replicate(4), 92, 44100);
var zeroPhase = amplify(seq.time, 0);

var pwmseq = sequencerFreq([[2, 30]], 92, 44100);
var pwmSin = amplify(oscHarm(pwmseq.time, pwmseq.freq, zeroPhase), 0.3);

//presynthesis
//var pentatonicOct = [57, 60, 62, 63, 64, 67];
var pentatonicOct = [57, 60, 62, 64, 67];
var pentatonic = pentatonicOct.concat(add(pentatonicOct, 12)).concat(add(pentatonicOct, 24));

var sounds = [];
for (var i = 0; i < pentatonic.length; ++i) {
    var seq = sequencer([[pentatonic[i], 0.5]], 92, 44100);
    //var data = hipass(amplify(oscSquare(seq.time, seq.freq, zeroPhase, pwmSin), 0.05));
    //var data = hipass(amplify(oscUltimateSaw(seq.time, seq.freq, zeroPhase), 0.05));    
    var data = hipass(amplify(oscHarm(seq.time, seq.freq, zeroPhase), 0.05));    
    var dataUri =  encodeAudio16bit(data, 44100);
    sounds.push(createAudio(dataUri));
}

var playedNotes = new Array(pentatonic.length);
for (var i = 0; i < pentatonic.length; ++i) {
    playedNotes[i] = 0;
}

var playingNode;
var playingEdge;
var graph;
var edit = function(graph_) {
    graph = graph_;
    if (graph.nodes.length == 0) {
        playingNode = undefined;
    }
    for (var i = 0; i < graph.nodes.length; ++i) {
        var node = graph.nodes[i];

        var kSize = pentatonic.length;
        var y = node.pos.y / graph.SIZE.y;
        var noteIdx = Math.floor(y * (kSize));
        if (noteIdx >= kSize) {
            noteIdx = kSize - 1;
        }
        node.noteIdx = noteIdx;
        
        var edges = [];
        for (var j = 0; j < graph.edge_list.length; ++j) {
            var edge = graph.edge_list[j];
            if (edge.node1 === node) {
                edges.push(edge);
            }
        }
        node.edges = edges;
    }
}

var draw = function(ctx, SIZE) {
    var keyCount = pentatonic.length;

    for (var i = 0; i < keyCount; i++) {
        var color = 255 - playedNotes[i] * 10;
        ctx.beginPath();
        var x = 0;
        var y = i * SIZE.y / (keyCount);
        var w = SIZE.x;
        var h = SIZE.y / (keyCount);
        ctx.rect(0, y, w-1, h-1);
        if (playedNotes[i] != 0) {
        ctx.fillStyle = 'rgb(' + color + ',255,' + color + ')';
            ctx.fillRect(0, y, 20, h - 1);
        }
        ctx.stroke();
    }

    //return;
}

var K4_graph = JSON.stringify(
               {"vertices": ["0", "1", "2", "3"],
                "edges": [["0", "1"], ["1", "2"], ["2", "3"]],
                "name": "G",
                "pos": {"0": [0.0, 1.0], "1": [0.2, 1.8], "2": [0.4, 3.5], "3": [0.6, 5.1]}});
my_graph_editor = new GraphEditor('#graph_ed1', {JSONdata : K4_graph,
                                                 onEdit : edit,
                                                 beforeDraw : draw,
                                                 directed : true});

graph = my_graph_editor.get_raw_data();
my_graph_editor.set_start(0);

var shouldReturnTTL = 16;

var fakeInterval = 4;

var id = timer(function () {

    fakeInterval--;
    if (fakeInterval > 0) {
        for (var i = 0; i < playedNotes.length; ++i) {
            if (playedNotes[i] > 0) {
                playedNotes[i]-=1;
            }
        }
        return;
    }
    fakeInterval = 4;

    var noOnePlaying = true;

    if (typeof playingNode != 'undefined') {
        var node = playingNode;

        playedNotes[node.noteIdx] = 25;

        sounds[node.noteIdx].play();        

        my_graph_editor.update_draw();
        var edges = node.edges;
        if (edges.length != 0) {
            if (node.way >= edges.length) {
                node.way = 0;
            }
            node.playing = false;
            edges[node.way].node2.playing = true;
            edges[node.way].laterplaying = false;

            if (typeof playingEdge != 'undefined') {
                playingEdge.nextplaying = false;
            }
            playingEdge = edges[node.way];
            playingEdge.nextplaying = true;
            playingNode = edges[node.way].node2;
            node.way += 1;
            if (node.way >= edges.length) {
                node.way = 0;
            }
            if (edges[node.way].length != 0) {
                edges[node.way].laterplaying = true;
            }
            noOnePlaying = false;
        }
    }


    for (var i = 0; i < playedNotes.length; ++i) {
        if (playedNotes[i] > 0) {
            playedNotes[i]-=1;
        }
    }

    shouldReturnTTL--;
    if (shouldReturnTTL == 0) {
        noOnePlaying = true;
        shouldReturnTTL = 16;
    }

    if (noOnePlaying) {
        for (var i = 0; i < graph.nodes.length; ++i) {
            var node = graph.nodes[i];
            node.playing = false;
            if (node.start_point == true) {
                node.playing = true;
                playingNode = node;
            }
        }
    }

}, 150);

};
