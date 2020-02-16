// import all packages
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const multerS3 = require('multer-s3');
const randomstring = require("randomstring");
const morgan = require('morgan');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk')

// configure app server
const app = express();
app.set('port', process.env.PORT);
app.use(morgan('combined'));
app.use(bodyParser.urlencoded({ limit: '1gb', extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.json({ limit: '1gb' }));
app.use(cors());

// update the AWS config
AWS.config.update({
    accessKeyId: `${process.env.AWS_ACCESSKEY}`,
    secretAccessKey: `${process.env.AWS_SECRET}`,
    region: 'ap-south-1'
});

// create S3 object
s3 = new AWS.S3();

// check mimetype of the file to check if csv was uploaded
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'text/csv') {
        cb(null, true)
    } else {
        return cb(new Error('Only .csv formats allowed'))
    }
}

// create multers3 config
const multerS3Config = multerS3({
    s3: s3,
    bucket: `${process.env.BUCKET_NAME}`,
    metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
        cb(null, `${randomstring.generate(10)}_${Date.now()}.csv`)
    }
});

// create multer object
const upload = multer({
    storage: multerS3Config,
    fileFilter: fileFilter,
    limits: {
        fileSize: 1024 * 1024 * 10 // we are allowing only 10 MB files
    }
});



// upload csv file
app.post('/v1/employee-data-upload', upload.single('employee_data'), function (req, res) {
    res.send({ "status": 200, "data": "file  uploaded" })
});



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
app.get('/v1/employees', async function (req, res) {
    let { limit, page, searchTerm } = req.query;
    if (!page && !limit) {
        page = 1
        limit = 10
    }
    offset = limit * (page - 1)
    if (searchTerm) {
        let model = knex.table('employees')
            .where('employee_name', 'ilike', `%${searchTerm}%`)
            .orWhere('email', 'ilike', `%${searchTerm}%`)
        let totalCount = await model.clone().count();
        let data = await model.clone().offset(offset).limit(limit).select()
        totalPages = Math.ceil(totalCount[0]['count'] / limit)
        res.send(
            {
                "status": 200,
                "data": data,
                "limit": parseInt(limit),
                "page": parseInt(page),
                "totalPages": totalPages,
                "size": data.length
            })
    } else {
        let model = knex.table('employees')
        let totalCount = await model.clone().count();
        let data = await model.clone().offset(offset).limit(limit).select()
        totalPages = Math.ceil(totalCount[0]['count'] / limit)
        res.send(
            {
                "status": 200,
                "data": data,
                "limit": parseInt(limit),
                "page": parseInt(page),
                "totalPages": totalPages,
                "size": data.length
            })
    }
});
module.exports = app;
