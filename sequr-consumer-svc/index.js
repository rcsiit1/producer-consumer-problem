/* Consumer Service to Consume SQS messages */

// contruct connection object
const options = {
    client: `${process.env.DB_CLIENT}`,
    connection: {
        host: `${process.env.DB_HOST}`,
        user: `${process.env.DB_USER}`,
        password: `${process.env.DB_PASSWORD}`,
        database: `${process.env.DB_NAME}`
    },
    pool: {
        min: 0,
        max: 15
      }
}

const knex = require('knex')(options);
const Joi = require('joi');
const AWS = require('aws-sdk');

// update the AWS config
AWS.config.update({
    accessKeyId: `${process.env.AWS_ACCESSKEY}`,
    secretAccessKey: `${process.env.AWS_SECRET}`,
    region: 'ap-south-1',
});

// use SQS with a specific apiversion
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

// common method to log messages
let log = (message) => {
    console.log(message);
}

// common method to log errors
let error = (message) => {
    console.error(message);
}

// function to delete processed message from SQS
let deleteSQSMessage = (receiptHandle) => {
    return new Promise(async (resolve, reject) => {
        try {
            const params = {
                QueueUrl: `${process.env.QUEUE_URL}`,
                ReceiptHandle: receiptHandle
            };
            let result = await sqs.deleteMessage(params);
            resolve(result)
        } catch (err) {
            reject(err);
        }
    });
}

// handler function which receives events from SQS
exports.handler = (event) => {
    log(`Received Event from SQS: ${event.Records[0]}`)
    let { messageAttributes, receiptHandle } = event.Records[0]

    // costruct object to validate against joi schema
    let record = {
        "employee_name": messageAttributes.employee_name.stringValue,
        "company_name": messageAttributes.company_name.stringValue,
        "email": messageAttributes.email.stringValue,
        "mobile_no": parseInt(messageAttributes.mobile_no.stringValue)
    }

    // define joi schema to be validated
    const schema = Joi.object({
        employee_name: Joi.string().max(50).required().options({ language: { any: { empty: 'is required' } } })
            .label('employee_name'),
        company_name: Joi.string().max(50).required().options({ language: { any: { empty: 'is required' } } })
            .label('company_name'),
        mobile_no: Joi.number().max(9999999999).min(1000000000).required().options({ language: { any: { empty: 'is required' } } })
            .label('mobile_no'),
        email: Joi.string().email().max(50).required().options({ language: { any: { empty: 'is required' } } })
            .label('email')
    });

    // validate schema against the message received from SQS
    const validationResult = Joi.validate(record, schema, { abortEarly: false });

    // check if the validation throws an error
    if (validationResult.error) {
        error(`Error: ${validationResult.error}`)
        throw new Error(`Record ${record} failed validation test`)
    }

    // value string formation
    let valueStr = `('${messageAttributes.employee_name.stringValue}',
                    '${messageAttributes.company_name.stringValue}',
                    '${messageAttributes.mobile_no.stringValue}',
                    '${messageAttributes.email.stringValue}')`
    
    // using Raw query as upsert/on conflict clause is not supported in knex
    let insertQuery = `INSERT into employees (employee_name,company_name,mobile_no,email)
                       values ${valueStr} ON CONFLICT (email) DO NOTHING`
    
    log(`Insert query : ${insertQuery}`);
    
    // insert record in the DB after validation
    knex.raw(insertQuery)
        .then(async function() {
            log(`${record} from SQS inserted successfully.`);
            let myresult = await deleteSQSMessage(receiptHandle)
            log(`SQS message Delete response : ${myresult}`)
            return `Successfully processed ${event.Records.length} messages.`;
        })
        .catch((err) => { error(err); throw new Error(err) })
        .finally(() => {
            // destroy the connection at end
            knex.destroy();
        });
};
