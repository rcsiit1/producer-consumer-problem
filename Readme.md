# producer-consumer-problem
These services were built using nodejs and AWS cloud services.There are two microservices i.e. Producer - Consumer,apis to upload csv file and list data with pagination.

## Producer
The producer service takes a `.csv` file as input and puts all data into an SQS queue in a batch of 10 (max supported).The producer gets the trigger from S3 when a file is uploaded.
* This service uses s3 bucket to store and trigger events on file upload
* A lambda function which recieves the trigger, fetches file from s3 and puts all the data into SQS queue.
* The `.csv` file should contain columns in sequence `employee_name,company_name,mobile_no,email`.

## Consumer
The consumer service consumes SQS events one at a time and puts data in the `RDS` postgresql instance db.
* There are two queues configured, first queue is the source queue from which the consumer lambda function gets the trigger once the message is visible in the queue.
* If under any circumstances the message in the queue remains unprocessed then it goes to `DLQ` (Dead Letter Queue). This queue can be later used to process unprocessed records and to investigate why they didn't make up the DB.
* The throttle of processing one message at a time from the queue can be configured while configuring the trigger from SQS. In this case the throttle was set to 1.
* The lambda function uses `knexjs` to perform db operations.


## Prerequisites

- [AWS Account](https://aws.amazon.com/)
- [Nodejs](https://nodejs.org/en/)
- [Expressjs](https://expressjs.com/)
- [Knexjs](http://knexjs.org/)

## AWS Resource
- AWS EC2 (For Hosting APIs)
- SQS
- S3
- Lambda
- Cloudwatch Logs
- IAM

## Installation
- Configure the environment variables in `.env` as shown in `/sequr-apis/sample.env`
- Go to each folder and run the following command.This would install all the dependencies for that specific resoruce.
    ```bash
     npm install
    ```
- Run the Node server
    ```bash
    node server.js
    ```
## Steps to configure AWS services
- Its always suggested to create a role and user with all required policies and permission from AWS `IAM`.
- Creating a role and attaching it to the resource would provide the resource access to other AWS resources.
- Creation of user from `IAM` would give programmatic access to AWS resources using `accesskey` and `secretkey`.

### Producer Infrastructure
- Create a S3 bucket with proper bucket policy
- Create a lambda function with `nodejs` as a runtime environment and proper permissons
- Navigate to the lambda function and configure a trigger from S3 bucket using Designer.
- Choose the events on which you want the lambda function to get triggered.
- Set the environment variables

### Consumer Infrastructure
- Create a SQS queue and a DLQ.
- Assign the DLQ to the source queue and set visibilitytime of the message and no of attempts after which the message will go the DLQ.
- Create a lambda function with `nodejs` as a runtime environment and proper permissons
- Navigate to the lambda function and configure a trigger from SQS using Designer.
- Choose the events on which you want the lambda function to get triggered.
- Set the environment variables


## API Specification

- API to upload `.csv` to `S3` bucket

   - POST  `/v1/employee-data-upload`
        - body
            ```
                {
                    "employee_data" : file
                }
            ```
- API to list all employee data with pagination
    - GET `/v1/employees?limit=10&searchTerm=xyz&page=1`
        - params
            ```
            limit:10
            searchTerm: 'xyz'
            page:1
            ```
    - Filter works for fields `employee_name` and `email`

## Know Issues
- knexjs sometimes fails to get a connection from the pool when there is burst of events from the SQS for lambda.

    Error:

    ```
    Error: Unable to acquire a connection
    ```
    - Possible Solutions
        - Put a random delay while sending messages to SQS that would not create a sudden burst of events for lambda which would result in better availability of connection.
        - Instead of processing messages one by one (which is costly operation) messages should be processed in batch after polling the queue.
        - Manage the knex pool efficiently.
    - Open Issues on Github
        - [Transactions hanging in AWS Lambda](https://github.com/knex/knex/issues/2445)
        - [AWS Discussion Forums](https://forums.aws.amazon.com/thread.jspa?threadID=216000)
        - [Bug: Connection terminated unexpectedly (postgres)](https://github.com/knex/knex/issues/3523)

## Enhancements
- Make the producer service independent of the csv column sequence(easily attainable).
- Consume messages from queue in batches not one by one as this would trigger lambda function n times for n messages.


