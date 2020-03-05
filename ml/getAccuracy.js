exports.getAccuracy = function (net, testData) {
    let hits = 0;
    testData.forEach((datapoint) => {
        const output = net.run(datapoint.input);
        const outputArray = [Math.round(output[0]), Math.round(output[1])];
        if (outputArray[0] === datapoint.output[0] && outputArray[1] === datapoint.output[1]) {
            hits += 1;
        }
    });
    return hits / testData.length;
}