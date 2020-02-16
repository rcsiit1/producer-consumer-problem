/* Producer Service to produce SQS messages from csv */
const AWS = require('aws-sdk');
const parse = require('csv-parser');
const randomstring = require("randomstring");

// update the AWS config
AWS.config.update({
    accessKeyId: `${process.env.AWS_ACCESSKEY}`,
    secretAccessKey: `${process.env.AWS_SECRET}`,
    region: 'ap-south-1'
});

// intialize SQS with a specific apiversion
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
// intialize S3 object
const s3 = new AWS.S3();

// common method to log messages
let log = (message) => {
    console.log(message);
}

// common method to log errors
let error = (message) => {
    console.error(message);
}

// function to form message object and send them to SQS
async function sendSqsMessage(rawMessages) {
    // calculate the no of iterations to process a batch size of 10 (max supported by SQS)
    iterations = Math.ceil(rawMessages.length / 10)
    for (let i = 0; i < iterations; i++) {
        // get the first 10 elements from the list
        intermediateArray = rawMessages.slice(0, 10);

        let transformedSqsMessage = intermediateArray.map(function (element) {
            // generate random string for ID
            let random = randomstring.generate(10)
            return {
                "Id": `${random}`,
                "DelaySeconds": 2,
                "MessageAttributes": {
                    "employee_name": {
                        "DataType": "String",
                        "StringValue": `${element[0]}`
                    },
                    "company_name": {
                        "DataType": "String",
                        "StringValue": `${element[1]}`
                    },
                    'mobile_no': {
                        "DataType": "String",
                        "StringValue": `${element[2]}`
                    },
                    'email': {
                        "DataType": "String",
                        "StringValue": `${element[3]}`
                    },
                },
                "MessageBody": "Entering employee data"
            }
        })
        let params = { "Entries": transformedSqsMessage, "QueueUrl": `${process.env.QUEUE_URL}` }
        sqs.sendMessageBatch(params, function (err, data) {
            if (err) {
                error(`Error: ${err.stack}`);
            } else {
                log(data);
            }
        });
        // take out processed records from the array
        rawMessages.splice(0, 10)

    }
    log('All messages Processed')
}

// landler function which receives event from S3
exports.handler = (event) => {
    log(`Event: ${event.Records[0].s3}`)
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const params = {
        Bucket: bucket,
        Key: key,
    };
    log(`Params: ${params}`);
    try {
        const stream = s3.getObject(params).createReadStream();
        let csvData = []
        stream.pipe(parse())
            .on('data', function (data) {
                const parsed_data = JSON.parse(JSON.stringify(data));
                const values = Object.values(parsed_data);
                csvData.push(values);
            })
            .on('end', function () {
                // after the processing is complete send SQS messages
                sendSqsMessage(csvData)
            });
        return `All employee Data sent to SQS successfully`;
    } catch (err) {
        error(err);
        throw err
    }
}