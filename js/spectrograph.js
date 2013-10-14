$(document).ready(function() {

    var Spectro = {};

    // AudioContext
    // ------------

    // TBD.
    Spectro.AudioContext = (window.AudioContext ||
                            window.webkitAudioContext ||
                            window.mozAudioContext ||
                            window.oAudioContext ||
                            window.msAudioContext);

    // AudioPlayer
    // -----------

    // Connects an input element to an audio element to create an audio player
    // that plays local audio files.
    Spectro.AudioPlayer = function(options) {
        options || (options = {});
        this.inputEl = options.inputEl;
        this.audioEl = options.audioEl;

        // Callback for when a file is selected via the input element that
        // attempts to read the file and connect it to the audio element.
        var selectAudio = function(event) {
            var self = this;
            var file = (self.file && self.files[0] ||
                        event.target && event.target.files[0] ||
                        {});
            if (file.type && file.type.match(/audio.*/)) {
                var reader = new FileReader();
                reader.onload = function(d) {
                    var e = $(self.audioEl).get(0);
                    e.src = d.target.result;
                    e.setAttribute("type", file.type);
                    e.setAttribute("controls", "controls");
                    e.setAttribute("autoplay", "true");
                };
                reader.readAsDataURL(file);
            }
        }
        selectAudio = _.bind(selectAudio, this);

        // Bind events
        $(this.inputEl).on('change', selectAudio);
    }

    var input = new Spectro.AudioPlayer({
        inputEl: '#file-input',
        audioEl: '#play'
    });

    var context = new Spectro.AudioContext(),
        sourceNode,
        analyser,
        scriptNode;

    // get the context from the canvas to draw on
    var ctx = $("#spectrograph").get()[0].getContext("2d");

    // create a temp canvas we use for copying
    var tempCanvas = document.createElement("canvas"),
        tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width=800;
    tempCanvas.height=512;

    // used for color distribution
    var color = new chroma.scale(['#000000', '#ff0000', '#ffff00', '#ffffff'])
                          .mode('rgb')
                          .domain([0, 300]);

    function setupAudioNodes() {
        // setup a analyzer
        analyser = context.createAnalyser();
        analyser.smoothingTimeConstant = 0;
        analyser.fftSize = 1024;

        // create a media element source node
        var mediaElement = document.getElementById('play');
        sourceNode = context.createMediaElementSource(mediaElement);

        // setup a javascript node
        scriptNode = context.createScriptProcessor(2048, 1, 1);

        // Route 1: Source -> Destination
        sourceNode.connect(context.destination);

        // Route 2: Source -> Analyser -> Script -> Destination
        sourceNode.connect(analyser);
        analyser.connect(scriptNode);
        scriptNode.connect(context.destination);

        // when the javascript node is called
        // we use information from the analyzer node
        // to draw the volume
        scriptNode.onaudioprocess = function () {
            // get the average for the first channel
            var array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);

            // draw the spectrogram
            if (sourceNode.mediaElement && !sourceNode.mediaElement.paused) {
                drawSpectrogram(array);
            }
        }
    }

    function drawSpectrogram(array) {
        // copy the current canvas onto the temp canvas
        var canvas = document.getElementById("spectrograph");

        tempCtx.drawImage(canvas, 0, 0, 800, 512);

        // iterate over the elements from the array
        for (var i = 0; i < array.length; i++) {
            // draw each pixel with the specific color
            var value = array[i];
            ctx.fillStyle = color(value).hex();

            // draw the line at the right side of the canvas
            ctx.fillRect(800 - 1, 512 - i, 1, 1);
        }

        // set translate on the canvas
        ctx.translate(-1, 0);
        // draw the copied image
        ctx.drawImage(tempCanvas, 0, 0, 800, 512, 0, 0, 800, 512);

        // reset the transformation matrix
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // D3 hack to draw an axis. This needs to be cleaned up!
    var margin = {top: 0, right: 0, bottom: 0, left: 5},
        width = 50;
        height = 512;

    var x = d3.scale.linear()
        .range([0, 512])
        .domain([22000, 0]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("right");

    var svg = d3.select("#lala").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    svg.append("g")
        .attr("class", "x axis")
        .call(xAxis);

    // load the sound
    setupAudioNodes();
});
