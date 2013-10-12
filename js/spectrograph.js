$(document).ready(function() {
    // create the audio context (chrome only for now)
    var context = new webkitAudioContext();
    var audioBuffer;
    var sourceNode;
    var analyser;
    var javascriptNode;

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

    // load the sound
    setupAudioNodes();

    function setupAudioNodes() {
        // setup a javascript node
        javascriptNode = context.createJavaScriptNode(2048, 1, 1);
        // connect to destination, else it isn't called
        javascriptNode.connect(context.destination);

        // setup a analyzer
        analyser = context.createAnalyser();
        analyser.smoothingTimeConstant = 0;
        analyser.fftSize = 1024;

        // create a media element source node
        var mediaElement = document.getElementById('play');
        sourceNode = context.createMediaElementSource(mediaElement);

        // wire that shit up!
        sourceNode.connect(analyser);
        analyser.connect(javascriptNode);
        sourceNode.connect(context.destination);
    }

    // when the javascript node is called
    // we use information from the analyzer node
    // to draw the volume
    javascriptNode.onaudioprocess = function () {
        // get the average for the first channel
        var array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);

        // draw the spectrogram
        if (sourceNode.mediaElement && !sourceNode.mediaElement.paused) {
            drawSpectrogram(array);
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

});
