const express = require('express');
const admin = require('firebase-admin')
const cors = require('cors');
const bodyParser = require('body-parser');
require("dotenv").config()
const app = express();
const port = process.env.PORT || 6000;

app.use(cors());
app.use(bodyParser.json());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}))

const serviceAccountKey = {
  "type": `${process.env.TYPE}`,
  "project_id": `${process.env.PROJECT_ID}`,
  "private_key_id": `${process.env.PRIVATE_KEY_ID}`,
  "private_key": `${(process.env.PRIVATE_KEY).split(String.raw`\n`).join("\n")}`,
  "client_email": `${process.env.CLIENT_EMAIL}`,
  "client_id": `${process.env.CLIENT_ID}`,
  "auth_uri": `${process.env.AUTH_URI}`,
  "token_uri": `${process.env.TOKEN_URI}`,
  "auth_provider_x509_cert_url": `${process.env.AUTH_PROVIDER_X509_CERT_URL}`,
  "client_x509_cert_url": `${process.env.CLIENT_X509_CERT_URL}`,
  "universe_domain": `${process.env.UNIVERSE_DOMAIN}`
};


admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey)
});

const db = admin.firestore();


//Fetch all documents
app.get(`/api/${process.env.ADMIN_KEY}/fetchDocuments`, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const page = parseInt(req.query.page) || 1;
  
      const snapshot = await db.collection('campaignMatching')
        .limit(limit)
        .offset((page - 1) * limit)
        .get();
  
      const documentNames = snapshot.docs.map(doc => doc.id);

      res.json({
        numberOfDocuments: documentNames.length,
        documentNames: documentNames
      });
    } catch (error) {
      console.error('Error fetching document names:', error);
      res.status(500).json({ error: 'Internal Server Error'});
    }
  });

//Fetch the details of a single document
app.get('/api/fetchDocuments/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const queryParams = req.query;

    const docSnapshot = await db.collection('campaignMatching').doc(documentId).get();

    if (!docSnapshot.exists) {
      return res.status(404).json({ error: 'Document not found', errorMessage: error.message });
    }

    const documentData = docSnapshot.data();

    if (Object.keys(queryParams).length === 0) {
      // If no custom parameters provided, send all keys and values
      res.json({
        document: documentData,
      });
    } else {
      // Display only requested fields
      const filteredData = Object.fromEntries(
        Object.entries(documentData).filter(([key]) => queryParams.hasOwnProperty(key))
      );

      res.json({
        document: filteredData,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error', errorMessage: error.message });
  }
});


  
//Fetch the all the documents whose status code is 200
app.get(`/api/${process.env.ADMIN_KEY}/processed`, async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    if (isNaN(parsedLimit) || isNaN(parsedPage) || parsedLimit <= 0 || parsedPage <= 0) {
      return res.status(400).json({ error: 'Invalid limit or page value' });
    }

    const snapshot = await db.collection('campaignMatching')
      .where('status.code', '==', 200)
      .limit(parsedLimit)
      .offset((parsedPage - 1) * parsedLimit)
      .get();

    const documents = snapshot.docs.map(doc => doc.data());

    res.json({
      numberOfDocuments: snapshot.size,
      documents,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error', errorMessage: error.message});
  }
});


//Fetch the all the documents based on parameters supplied
app.get(`/api/${process.env.ADMIN_KEY}/custom`, async (req, res) => {
  try {
    const { limit = 10, page = 1, ...queryParams } = req.query;

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    if (isNaN(parsedLimit) || isNaN(parsedPage) || parsedLimit <= 0 || parsedPage <= 0) {
      return res.status(400).json({ error: 'Invalid limit or page value' });
    }

    let query = db.collection('campaignMatching').limit(parsedLimit).offset((parsedPage - 1) * parsedLimit);

    // Filter based on status.code if provided
    if (queryParams.hasOwnProperty('status.code')) {
      query = query.where('status.code', '==', parseInt(queryParams['status.code']));
    }

    // Add more conditions for other query parameters as needed

    const snapshot = await query.get();
    const documents = snapshot.docs.map(doc => {
      const data = doc.data();
      // Display only requested fields
      const filteredData = Object.fromEntries(
        Object.entries(data).filter(([key]) => queryParams.hasOwnProperty(key))
      );
      return filteredData;
    });

    res.json({
      numberOfDocuments: snapshot.size,
      documents,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error', errorMessage: error.message});
  }
});

//Check whether the status code of a document is 200 or not
app.get('/api/checkStatus/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    const docSnapshot = await db.collection('campaignMatching').doc(documentId).get();

    if (!docSnapshot.exists) {
      return res.status(404).json({ error: 'Document not found', errorMessage: 'Document not found' });
    }

    const documentData = docSnapshot.data();
    const statusCode = documentData.status ? documentData.status.code : null;

    if (statusCode === 200) {
      res.json(true);
    } else {
      res.json(false);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error', errorMessage: error.message });
  }
});


app.listen(port, () => {
    console.log(`Successfully connected to Database... Server is running on ${port}`)
})
