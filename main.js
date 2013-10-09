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

function noteNumberToFreq(midiNumber) {
    A4number = 57;
    return 440.0 * Math.pow(2, (midiNumber - A4number) / 12.0);
}

Array.prototype.replicate = function(count) {
    var l = this.length;
    var b = new Array();
    for(i=0; i<count; i++) {
        b = b.concat(this);
    }
    return b;
};

function add(input, amp) {
    var l = input.length;
    var output = [];
    for (var tIdx = 0; tIdx < l; ++tIdx) {
        output.push( input[tIdx] + amp  );
    }
    return output;
}

function mul(input, amp) {
    var l = input.length;
    var output = [];
    for (var tIdx = 0; tIdx < l; ++tIdx) {
        output.push( input[tIdx] * amp  );
    }
    return output;
}

var timerInterval = 140;

context = new webkitAudioContext();

var convolver = context.createConvolver();
convolver.connect(context.destination);

var impulseResponseUrl = 'l960large_room.wav';
var request = new XMLHttpRequest();
request.open("GET", impulseResponseUrl, true);
request.responseType = "arraybuffer";
 
request.onload = function () {
    convolver.buffer = context.createBuffer(request.response, false);
};
request.send();

gainNode = context.createGainNode();
gainNode.gain.value = 0;
gainNode.connect(convolver);

function playFreq(freq) {
    var osc = context.createOscillator();
    osc.type = "sine";
    osc.connect(gainNode);
    osc.frequency.value = 0;
    osc.start(0);

    var now = context.currentTime;
    osc.frequency.value = freq;
    gainNode.gain.linearRampToValueAtTime(0.5, now + 0.1);
    gainNode.gain.linearRampToValueAtTime(0.0, now + 0.3);
    setTimeout(function(){osc.stop(0);}, timerInterval*2);
}

//presynthesis
var pentatonicOct = [57, 60, 62, 64, 67];
var pentatonic = pentatonicOct.concat(add(pentatonicOct, 12)).concat(add(pentatonicOct, 24));
var pentatonicFreq = pentatonic.map(noteNumberToFreq);

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

        playFreq(pentatonicFreq[node.noteIdx]);

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

}, timerInterval);

};
