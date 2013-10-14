$(document).ready(function() {

    var Spectro = {};

    // Spectro.AudioContext
    // ------------

    // TBD.
    Spectro.AudioContext = (window.AudioContext ||
                            window.webkitAudioContext ||
                            window.mozAudioContext ||
                            window.oAudioContext ||
                            window.msAudioContext);

    // Spectro.AudioPlayer
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

        // Bind events.
        $(this.inputEl).on('change', selectAudio);
    }

    // Spectro.Axis
    // ------------

    // Creates a d3 axis for use with a Spectro.Graph object.
    Spectro.Axis = function(options) {
        options || (options = {});
        this.element = options.element;
        this.height = options.height;
        this.width = options.width;
        this.range = options.range;
        this.domain = options.domain;

        // D3 hack to draw an axis. This needs to be cleaned up!
        var margin = {top: 0, right: 0, bottom: 0, left: 5},
            width = this.width;
            height = this.height;

        var x = d3.scale.linear()
            .range(this.range)
            .domain(this.domain);

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("right");

        var svg = d3.select(this.element).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        svg.append("g")
            .attr("class", "x axis")
            .call(xAxis);
    }

    // Spectro.Graph
    // -------------

    // Draw a spectrogram to a canvas element.
    Spectro.Graph = function(options) {
        options || (options = {});
        this.canvasEl = options.canvasEl;

        // Le canvas
        var $el = $(this.canvasEl);
        this.height = $el.height();
        this.width = $el.width();
        this.canvasContext = $el.get(0).getContext('2d');

        // Create a temporary canvas to act as a buffer
        this.tempCanvas = document.createElement("canvas");
        this.tempCanvasContext = this.tempCanvas.getContext("2d");
        this.tempCanvas.width=this.width;
        this.tempCanvas.height=this.height;

        // Setup colors
        var palette = ['#000000', '#ff0000', '#ffff00', '#ffffff'];
        this.color = new chroma.scale(palette)
                               .mode('rgb')
                               .domain([0, 300]);

        // Add an axis to the graph.
        var axis = new Spectro.Axis({
            element: '#graph',
            height: 512,
            width: 50,
            range: [0, 512],
            domain: [22000, 0]
        });
    }

    // Set up all inheritable **Spectro.Graph** properties and methods.
    _.extend(Spectro.Graph.prototype, {

        // Callback method for drawing the spectrogram in real time.
        drawSpectrogram: function(array) {
            var canvas = $(this.canvasEl).get(0),
                ctx = this.canvasContext,
                tempCanvas = this.tempCanvas,
                tempCanvasContext = this.tempCanvasContext,
                height = this.height,
                width = this.width,
                color = this.color;

            // Copy the current canvas onto the temp canvas.
            tempCanvasContext.drawImage(canvas, 0, 0, width, height);

            // Iterate over the elements from the array.
            for (var i = 0; i < array.length; i++) {
                // Draw each pixel with the specific color.
                var value = array[i];
                ctx.fillStyle = color(value).hex();

                // Draw the line at the right side of the canvas.
                ctx.fillRect(width - 1, height - i, 1, 1);
            }

            // Set translate on the canvas.
            ctx.translate(-1, 0);
            // Draw the copied image.
            ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, width, height);
            // Reset the transformation matrix.
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

    });

    // Spectro.Spectrograph
    // --------------------

    // The spectrograph ties all the components together to create a single
    // interface to the spectrograph.
    Spectro.Spectrograph = function(options) {
        options || (options = {});
        this.context = options.context;
        this.scriptNode = options.scriptNode;
        this.inputEl = options.inputEl;
        this.audioEl = options.audioEl;
        this.canvasEl = options.canvasEl;
        this.initialize();
    }

    // Set up all inheritable **Spectro.Spectrograph** properties and methods.
    _.extend(Spectro.Spectrograph.prototype, {

        initialize: function() {
            // Initialize components.
            var input = new Spectro.AudioPlayer({
                inputEl: this.inputEl,
                audioEl: this.audioEl
            });
            var graph = new Spectro.Graph({
                canvasEl: this.canvasEl
            });

            this.setupAudioNodes(this.context, graph);
        },

        setupAudioNodes: function(context, graph) {
            // setup a analyzer
            var analyser = context.createAnalyser();
            analyser.smoothingTimeConstant = 0;
            analyser.fftSize = 1024;

            // create a media element source node
            var mediaElement = $(this.audioEl).get(0);
            var sourceNode = context.createMediaElementSource(mediaElement);

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
                    graph.drawSpectrogram(array);
                }
            }
        }
    });

    // Create a context and a scriptNode object. Both these nodes seem
    // dependent on scope at this level...
    var context = new Spectro.AudioContext(),
        scriptNode;

    // Create a Spectrograph object to get the party started!
    var sg = new Spectro.Spectrograph({
        context: context,
        scriptNode: scriptNode,
        inputEl: '#file-input',
        audioEl: '#play',
        canvasEl: '#spectrograph'
    });

});
