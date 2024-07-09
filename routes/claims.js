const express = require('express'); // Import Express to create a router
const Claim = require('../models/Claim'); // Import the Claim model to interact with the claims collection in MongoDB
const path = require('path'); // Import Path to handle file and directory paths
const { ensureAuthenticated, ensureRoles, ensureRole } = require('../middleware/auth'); // Import authentication and role-checking middleware
const logActivity = require('../middleware/activityLogger'); // Import activity logging middleware
const { notifyNewClaim, notifyClaimStatusUpdate } = require('../notifications/notify'); // Import notification functions
const csv = require('csv-express'); // Import csv-express for CSV export
const ExcelJS = require('exceljs'); // Import ExcelJS for Excel export
const PDFDocument = require('pdfkit'); // Import PDFKit for PDF export
const fs = require('fs'); // Import File System to handle file operations
const cacheManager = require('cache-manager'); // Import cache manager for caching
const redisStore = require('cache-manager-redis-store'); // Import Redis store for cache manager
const pinoLogger = require('../logger'); // Import Pino logger

// Setup cache manager with Redis
const cache = cacheManager.caching({
    store: redisStore,
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    ttl: 600 // Time-to-live for cached data (in seconds)
});

const router = express.Router(); // Create a new router

// Define sensitive fields that should not be logged
const sensitiveFields = ['password', 'token', 'ssn'];

// Function to filter out sensitive fields from the request body
const filterSensitiveData = (data) => {
    if (!data || typeof data !== 'object') {
        return data;
    }
    
    return Object.keys(data).reduce((filteredData, key) => {
        if (sensitiveFields.includes(key)) {
            filteredData[key] = '***REDACTED***'; // Mask the sensitive field
        } else if (typeof data[key] === 'object') {
            filteredData[key] = filterSensitiveData(data[key]); // Recursively filter nested objects
        } else {
            filteredData[key] = data[key];
        }
        return filteredData;
    }, {});
};

// Helper function to log requests with user and session info
const logRequest = (req, message, extra = {}) => {
    const { method, originalUrl, headers, body } = req;
    const filteredBody = filterSensitiveData(body); // Filter sensitive data from the request body

    pinoLogger.info({
        message,
        user: req.user ? req.user.email : 'Unauthenticated',
        ip: req.ip,
        sessionId: req.sessionID,
        method,
        url: originalUrl,
        headers: {
            'User-Agent': headers['user-agent'],
            'Referer': headers['referer'],
            // Add other headers if needed
        },
        requestBody: filteredBody, // Log the filtered request body
        timestamp: new Date().toISOString(),
        ...extra
    });
};

// Initialize file categories if not present
const initializeFileCategories = (files) => {
    return {
        incidentReports: files.incidentReports || [],
        correspondence: files.correspondence || [],
        rentalAgreement: files.rentalAgreement || [],
        policeReport: files.policeReport || [],
        invoices: files.invoices || [],
        photos: files.photos || []
    };
};

// Route to export a claim as PDF
router.get('/:id/export', ensureAuthenticated, ensureRoles(['admin', 'manager', 'employee']), async (req, res) => {
    const claimId = req.params.id;
    logRequest(req, `Exporting claim to PDF with ID: ${claimId}`);

    try {
        const claim = await Claim.findById(claimId).exec();
        if (!claim) {
            logRequest(req, `Claim with ID ${claimId} not found`, { level: 'error' });
            return res.status(404).render('404', { message: 'Claim not found' });
        }

        const doc = new PDFDocument();
        const filename = `claim_${claimId}.pdf`;

        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Type', 'application/pdf');

        doc.pipe(res);

        doc.text('Claim Report', { align: 'center' });
        doc.text(`MVA: ${claim.mva}`);
        doc.text(`Customer Name: ${claim.customerName}`);
        doc.text(`Customer Number: ${claim.customerNumber}`);
        doc.text(`Customer Email: ${claim.customerEmail}`);
        doc.text(`Customer Address: ${claim.customerAddress}`);
        doc.text(`Customer Drivers License: ${claim.customerDriversLicense}`);
        doc.text(`Car Make: ${claim.carMake}`);
        doc.text(`Car Model: ${claim.carModel}`);
        doc.text(`Car Year: ${claim.carYear}`);
        doc.text(`Car Color: ${claim.carColor}`);
        doc.text(`Car VIN: ${claim.carVIN}`);
        doc.text(`Accident Date: ${claim.accidentDate ? new Date(claim.accidentDate).toLocaleDateString() : ''}`);
        doc.text(`Billable: ${claim.billable}`);
        doc.text(`Is Renter At Fault: ${claim.isRenterAtFault}`);
        doc.text(`Damages Total: ${claim.damagesTotal}`);
        doc.text(`Body Shop Name: ${claim.bodyShopName}`);
        doc.text(`RA Number: ${claim.raNumber}`);
        doc.text(`Insurance Carrier: ${claim.insuranceCarrier}`);
        doc.text(`Insurance Agent: ${claim.insuranceAgent}`);
        doc.text(`Insurance Phone Number: ${claim.insurancePhoneNumber}`);
        doc.text(`Insurance Fax Number: ${claim.insuranceFaxNumber}`);
        doc.text(`Insurance Address: ${claim.insuranceAddress}`);
        doc.text(`Insurance Claim Number: ${claim.insuranceClaimNumber}`);
        doc.text(`Third Party Name: ${claim.thirdPartyName}`);
        doc.text(`Third Party Phone Number: ${claim.thirdPartyPhoneNumber}`);
        doc.text(`Third Party Insurance Name: ${claim.thirdPartyInsuranceName}`);
        doc.text(`Third Party Policy Number: ${claim.thirdPartyPolicyNumber}`);
        doc.text(`Renting Location: ${claim.rentingLocation}`);
        doc.text(`LDW Accepted: ${claim.ldwAccepted}`);
        doc.text(`Police Department: ${claim.policeDepartment}`);
        doc.text(`Police Report Number: ${claim.policeReportNumber}`);
        doc.text(`Claim Close Date: ${claim.claimCloseDate ? new Date(claim.claimCloseDate).toLocaleDateString() : ''}`);
        doc.text(`Vehicle Odometer: ${claim.vehicleOdometer}`);
        doc.text(`Description: ${claim.description}`);
        doc.text(`Damage Type: ${claim.damageType}`);
        doc.text(`Status: ${claim.status}`);
        doc.text(`Date: ${new Date(claim.date).toLocaleDateString()}`);
        // New fields added to PDF export
        doc.text(`Renters Liability Insurance: ${claim.rentersLiabilityInsurance}`);
        doc.text(`Loss Damage Waiver: ${claim.lossDamageWaiver}`);
        doc.moveDown();

        // Ensure claim.files is defined
        const files = claim.files || {};
        const fileCategories = [
            { title: 'Incident Reports', files: files.incidentReports || [] },
            { title: 'Correspondence', files: files.correspondence || [] },
            { title: 'Rental Agreement', files: files.rentalAgreement || [] },
            { title: 'Police Report', files: files.policeReport || [] },
            { title: 'Invoices', files: files.invoices || [] },
            { title: 'Photos', files: files.photos || [] }
        ];

        for (const category of fileCategories) {
            doc.text(`${category.title}:`);
            for (const file of category.files) {
                doc.text(file);
                const filePath = path.join(__dirname, '../public/uploads', file);
                try {
                    if (file.match(/\.(png|jpg|jpeg)$/i)) {
                        doc.image(filePath, { fit: [250, 300], align: 'center' });
                    } else if (file.match(/\.pdf$/i)) {
                        doc.addPage().text(`Embedded PDF: ${file}`, { align: 'center' });
                        doc.file(filePath);
                        doc.fileAttachmentAnnotation(250, 300, 100, 50, filePath, { description: `Embedded PDF: ${file}` });
                    } else {
                        doc.text('Unsupported file format for embedding. Click link to access: ');
                        doc.text(`${filePath}`, { link: filePath });
                    }
                } catch (error) {
                    logRequest(req, 'Error adding file to PDF:', { error });
                    doc.text('Error loading file.');
                }
                doc.moveDown();
            }
        }

        doc.end();
    } catch (err) {
        logRequest(req, 'Error exporting claim to PDF:', { error: err });
        res.status(500).render('500', { message: 'Internal Server Error' });
    }
});

// Route to display the add claim form
router.get('/add', ensureAuthenticated, ensureRoles(['admin', 'manager']), (req, res) => {
    logRequest(req, 'Add claim route accessed');
    res.render('add_claim', { title: 'Add Claim' });
});

// Route to search for claims, accessible by admin, manager, and employee
router.get('/search', ensureAuthenticated, ensureRoles(['admin', 'manager', 'employee']), (req, res) => {
    logRequest(req, 'Claims search route accessed');
    const { mva, customerName, vin, claimNumber, damageType, status, raNumber, dateOfLossStart, dateOfLossEnd, startDate, endDate } = req.query;

    // Build a filter object based on provided query parameters
    let filter = {};
    if (mva) filter.mva = mva;
    if (customerName) filter.customerName = new RegExp(customerName, 'i'); // Case-insensitive search
    if (vin) filter.carVIN = new RegExp(vin, 'i'); // Case-insensitive search for VIN
    if (claimNumber) filter.insuranceClaimNumber = new RegExp(claimNumber, 'i'); // Case-insensitive search for claim number
    if (damageType) filter.damageType = { $in: Array.isArray(damageType) ? damageType : [damageType] }; // Search for any of the selected damage types
    if (status) filter.status = { $in: Array.isArray(status) ? status : [status] }; // Search for any of the selected statuses
    if (raNumber) filter.raNumber = raNumber;
    if (dateOfLossStart || dateOfLossEnd) {
        filter.dateOfLoss = {};
        if (dateOfLossStart) filter.dateOfLoss.$gte = new Date(dateOfLossStart); // Filter by start date of loss
        if (dateOfLossEnd) filter.dateOfLoss.$lte = new Date(dateOfLossEnd); // Filter by end date of loss
    }
    if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate); // Filter by start date
        if (endDate) filter.date.$lte = new Date(endDate); // Filter by end date
    }

    // Find claims based on the filter object
    Claim.find(filter)
        .then(claims => {
            logRequest(req, 'Claims found', { claims });
            res.render('claims_search', { claims, filter }); // Pass the filter back to the view to maintain search criteria
        }) // Respond with filtered claims
        .catch(err => {
            logRequest(req, 'Error fetching claims:', { error: err });
            res.status(500).json({ error: err.message });
        }); // Handle errors
});

// Route to get all claims or filter claims based on query parameters, accessible by admin, manager, and employee
router.get('/', ensureAuthenticated, ensureRoles(['admin', 'manager', 'employee']), logActivity('Viewed claims list'), async (req, res) => {
    logRequest(req, 'Fetching claims with query:', { query: req.query });
    const { mva, customerName, status, startDate, endDate } = req.query; // Extract query parameters

    // Build a filter object based on provided query parameters
    let filter = {};
    if (mva) filter.mva = mva;
    if (customerName) filter.customerName = new RegExp(customerName, 'i'); // Case-insensitive search
    if (status) filter.status = status;
    if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate); // Filter by start date
        if (endDate) filter.date.$lte = new Date(endDate); // Filter by end date
    }

    const cacheKey = JSON.stringify(filter); // Create a cache key based on the filter

    try {
        // Attempt to get the cached data
        const cachedClaims = await cache.get(cacheKey);
        if (cachedClaims) {
            logRequest(req, 'Returning cached claims data:', { cachedClaims });
            // If cached data exists, respond with it
            return res.json(cachedClaims);
        }

        // If no cached data, fetch claims from the database
        const claims = await Claim.find(filter).exec();
        logRequest(req, 'Claims fetched from database:', { claims });
        // Cache the fetched data
        await cache.set(cacheKey, claims);
        // Respond with the fetched data
        res.json(claims);
    } catch (err) {
        logRequest(req, 'Error fetching claims:', { error: err });
        res.status(500).json({ error: err.message }); // Handle errors
    }
});

// Route to add a new claim, accessible by admin and manager
router.post('/', ensureAuthenticated, ensureRoles(['admin', 'manager']), logActivity('Added new claim'), async (req, res) => {
    logRequest(req, 'Adding new claim with data:', { data: req.body });
    const {
        mva, customerName, description, status, damageType, dateOfLoss, raNumber, rentingLocation,
        ldwAccepted, policeDepartment, policeReportNumber, claimCloseDate, vehicleOdometer,
        customerNumber, customerEmail, customerAddress, customerDriversLicense, carMake,
        carModel, carYear, carColor, carVIN, accidentDate, billable, isRenterAtFault,
        damagesTotal, bodyShopName, insuranceCarrier, insuranceAgent, insurancePhoneNumber,
        insuranceFaxNumber, insuranceAddress, insuranceClaimNumber, thirdPartyName,
        thirdPartyPhoneNumber, thirdPartyInsuranceName, thirdPartyPolicyNumber,
        // New fields
        rentersLiabilityInsurance, lossDamageWaiver
    } = req.body;

    let files = initializeFileCategories({});

    if (req.files) {
        try {
            await Promise.all(Object.keys(req.files).map(async (category) => {
                if (Array.isArray(req.files[category])) {
                    await Promise.all(req.files[category].map(async (file) => {
                        const filePath = path.join(__dirname, '../public/uploads', file.name);
                        await file.mv(filePath);
                        logRequest(req, 'File uploaded successfully:', { fileName: file.name });
                        files[category].push(file.name);
                    }));
                } else {
                    const file = req.files[category];
                    const filePath = path.join(__dirname, '../public/uploads', file.name);
                    await file.mv(filePath);
                    logRequest(req, 'File uploaded successfully:', { fileName: file.name });
                    files[category].push(file.name);
                }
            }));
        } catch (err) {
            logRequest(req, 'Error uploading files:', { error: err });
            return res.status(500).json({ error: err.message });
        }
    }

    const newClaim = new Claim({
        mva, customerName, description, status, damageType, dateOfLoss, raNumber, rentingLocation,
        ldwAccepted, policeDepartment, policeReportNumber, claimCloseDate, vehicleOdometer,
        customerNumber, customerEmail, customerAddress, customerDriversLicense, carMake,
        carModel, carYear, carColor, carVIN, accidentDate, billable, isRenterAtFault,
        damagesTotal, bodyShopName, insuranceCarrier, insuranceAgent, insurancePhoneNumber,
        insuranceFaxNumber, insuranceAddress, insuranceClaimNumber, thirdPartyName,
        thirdPartyPhoneNumber, thirdPartyInsuranceName, thirdPartyPolicyNumber,
        rentersLiabilityInsurance, lossDamageWaiver, // New fields
        files
    });

    try {
        const claim = await newClaim.save();
        logRequest(req, 'New claim added:', { claim });
        notifyNewClaim(req.user.email, claim);
        cache.del('/claims');
        res.redirect('/dashboard');
    } catch (err) {
        logRequest(req, 'Error adding new claim:', { error: err });
        res.status(500).json({ error: err.message });
    }
});

// Route to get a specific claim by ID for editing, accessible by admin and manager
router.get('/:id/edit', ensureAuthenticated, ensureRoles(['admin', 'manager']), logActivity('Viewed claim edit form'), async (req, res) => {
    const claimId = req.params.id;
    logRequest(req, `Fetching claim for editing with ID: ${claimId}`);

    try {
        const claim = await Claim.findById(claimId).exec();
        if (!claim) {
            logRequest(req, `Claim with ID ${claimId} not found`, { level: 'error' });
            return res.status(404).render('404', { message: 'Claim not found' });
        }

        // Ensure files field is initialized correctly
        claim.files = initializeFileCategories(claim.files || {});

        logRequest(req, `Claim fetched for editing: ${claim}`);
        res.render('claims_edit', { title: 'Edit Claim', claim });
    } catch (err) {
        logRequest(req, 'Error fetching claim for editing:', { error: err });
        res.status(500).render('500', { message: 'Internal Server Error' });
    }
});

// Route to update a claim by ID, accessible by admin and manager
router.put('/:id', ensureAuthenticated, ensureRoles(['admin', 'manager']), logActivity('Updated claim'), async (req, res) => {
    const claimId = req.params.id;
    logRequest(req, `Updating claim with ID: ${claimId}`);

    try {
        const claim = await Claim.findById(claimId).exec();
        if (!claim) {
            logRequest(req, `Claim with ID ${claimId} not found`, { level: 'error' });
            return res.status(404).json({ error: 'Claim not found' });
        }

        if (!claim.versions) {
            claim.versions = [];
        }

        claim.versions.push({
            description: claim.description,
            status: claim.status,
            files: claim.files,
            updatedAt: claim.updatedAt
        });

        // Update the claim with new data from req.body
        Object.assign(claim, req.body);

        // Update the claim with new data
        claim.mva = req.body.mva || claim.mva;
        claim.customerName = req.body.customerName || claim.customerName;
        claim.description = req.body.description || claim.description;
        claim.status = req.body.status || claim.status;
        claim.damageType = req.body.damageType || claim.damageType; // Added damageType
        claim.dateOfLoss = req.body.dateOfLoss || claim.dateOfLoss;
        claim.raNumber = req.body.raNumber || claim.raNumber;
        claim.rentingLocation = req.body.rentingLocation || claim.rentingLocation;
        claim.ldwAccepted = req.body.ldwAccepted || claim.ldwAccepted;
        claim.policeDepartment = req.body.policeDepartment || claim.policeDepartment;
        claim.policeReportNumber = req.body.policeReportNumber || claim.policeReportNumber;
        claim.claimCloseDate = req.body.claimCloseDate || claim.claimCloseDate;
        claim.vehicleOdometer = req.body.vehicleOdometer || claim.vehicleOdometer;
        claim.customerNumber = req.body.customerNumber || claim.customerNumber;
        claim.customerEmail = req.body.customerEmail || claim.customerEmail;
        claim.customerAddress = req.body.customerAddress || claim.customerAddress;
        claim.customerDriversLicense = req.body.customerDriversLicense || claim.customerDriversLicense;
        claim.carMake = req.body.carMake || claim.carMake;
        claim.carModel = req.body.carModel || claim.carModel;
        claim.carYear = req.body.carYear || claim.carYear;
        claim.carColor = req.body.carColor || claim.carColor;
        claim.carVIN = req.body.carVIN || claim.carVIN;
        claim.accidentDate = req.body.accidentDate || claim.accidentDate;
        claim.billable = req.body.billable || claim.billable;
        claim.isRenterAtFault = req.body.isRenterAtFault || claim.isRenterAtFault;
        claim.damagesTotal = req.body.damagesTotal || claim.damagesTotal;
        claim.bodyShopName = req.body.bodyShopName || claim.bodyShopName;
        claim.insuranceCarrier = req.body.insuranceCarrier || claim.insuranceCarrier;
        claim.insuranceAgent = req.body.insuranceAgent || claim.insuranceAgent;
        claim.insurancePhoneNumber = req.body.insurancePhoneNumber || claim.insurancePhoneNumber;
        claim.insuranceFaxNumber = req.body.insuranceFaxNumber || claim.insuranceFaxNumber;
        claim.insuranceAddress = req.body.insuranceAddress || claim.insuranceAddress;
        claim.insuranceClaimNumber = req.body.insuranceClaimNumber || claim.insuranceClaimNumber;
        claim.thirdPartyName = req.body.thirdPartyName || claim.thirdPartyName;
        claim.thirdPartyPhoneNumber = req.body.thirdPartyPhoneNumber || claim.thirdPartyPhoneNumber;
        claim.thirdPartyInsuranceName = req.body.thirdPartyInsuranceName || claim.thirdPartyInsuranceName;
        claim.thirdPartyPolicyNumber = req.body.thirdPartyPolicyNumber || claim.thirdPartyPolicyNumber;
        claim.rentersLiabilityInsurance = req.body.rentersLiabilityInsurance || claim.rentersLiabilityInsurance; // Added rentersLiabilityInsurance
        claim.lossDamageWaiver = req.body.lossDamageWaiver || claim.lossDamageWaiver; // Added lossDamageWaiver

        let existingFiles = claim.files || {};

        if (req.files) {
            try {
                await Promise.all(Object.keys(req.files).map(async (category) => {
                    if (Array.isArray(req.files[category])) {
                        await Promise.all(req.files[category].map(async (file) => {
                            const filePath = path.join(__dirname, '../public/uploads', file.name);
                            await file.mv(filePath);
                            logRequest(req, 'File uploaded successfully:', { fileName: file.name });
                            if (!existingFiles[category]) {
                                existingFiles[category] = [];
                            }
                            existingFiles[category].push(file.name);
                        }));
                    } else {
                        const file = req.files[category];
                        const filePath = path.join(__dirname, '../public/uploads', file.name);
                        await file.mv(filePath);
                        logRequest(req, 'File uploaded successfully:', { fileName: file.name });
                        if (!existingFiles[category]) {
                            existingFiles[category] = [];
                        }
                        existingFiles[category].push(file.name);
                    }
                }));
            } catch (err) {
                logRequest(req, 'Error uploading files:', { error: err });
                return res.status(500).json({ error: err.message });
            }
        }

        claim.files = existingFiles;

        const updatedClaim = await claim.save();
        logRequest(req, 'Claim updated:', { updatedClaim });
        notifyClaimStatusUpdate(req.user.email, updatedClaim);
        cache.del(`claim_${claimId}`);
        cache.del('/claims');
        res.redirect(`/claims/${claimId}`); // Redirect to the updated claim's detail page
    } catch (err) {
        logRequest(req, `Error updating claim: ${err}`, { error: err });
        res.status(500).json({ error: err.message });
    }
});

// Route to delete a claim by ID, accessible only by admin
router.delete('/:id', ensureAuthenticated, ensureRole('admin'), logActivity('Deleted claim'), async (req, res) => {
    const claimId = req.params.id;

    logRequest(req, 'Deleting claim with ID:', { claimId });

    try {
        const claim = await Claim.findByIdAndDelete(claimId);
        if (!claim) {
            logRequest(req, `Claim with ID ${claimId} not found`, { level: 'error' });
            return res.status(404).json({ error: 'Claim not found' });
        }
        logRequest(req, 'Claim deleted:', { claimId });
        res.json({ msg: 'Claim deleted' }); // Respond with deletion confirmation
        cache.del(`claim_${claimId}`); // Invalidate the cache for the deleted claim
        cache.del('/claims'); // Invalidate the cache for claims list
    } catch (err) {
        logRequest(req, 'Error deleting claim:', { error: err });
        res.status(500).json({ error: err.message });
    }
});

// Route for bulk updating claims, accessible by admin and manager
router.put('/bulk/update', ensureAuthenticated, ensureRoles(['admin', 'manager']), logActivity('Bulk updated claims'), async (req, res) => {
    const { claimIds, updateData } = req.body; // Extract claim IDs and update data from the request body

    logRequest(req, 'Bulk updating claims with IDs:', { claimIds, updateData });

    try {
        // Update multiple claims based on provided IDs and data
        const result = await Claim.updateMany({ _id: { $in: claimIds } }, updateData);
        logRequest(req, 'Claims updated:', { result });
        res.json({ msg: 'Claims updated', result }); // Respond with update result
        claimIds.forEach(id => cache.del(`claim_${id}`)); // Invalidate the cache for the updated claims
        cache.del('/claims'); // Invalidate the cache for claims list
    } catch (err) {
        logRequest(req, 'Error bulk updating claims:', { error: err });
        res.status(500).json({ error: err.message }); // Handle errors
    }
});

// Route for bulk exporting claims, accessible by admin and manager
router.post('/bulk/export', ensureAuthenticated, ensureRoles(['admin', 'manager']), logActivity('Bulk exported claims'), async (req, res) => {
    const { claimIds, format } = req.body; // Extract claim IDs and export format from the request body

    logRequest(req, 'Bulk exporting claims with IDs:', { claimIds, format });

    try {
        // Find claims based on provided IDs
        const claims = await Claim.find({ _id: { $in: claimIds } });

        if (format === 'csv') {
            logRequest(req, 'Exporting claims to CSV');
            res.csv(claims, true); // Export claims to CSV
        } else if (format === 'excel') {
            logRequest(req, 'Exporting claims to Excel');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Claims');
            worksheet.columns = [
                { header: 'MVA', key: 'mva', width: 10 },
                { header: 'Customer Name', key: 'customerName', width: 30 },
                { header: 'Description', key: 'description', width: 50 },
                { header: 'Status', key: 'status', width: 10 },
                { header: 'Date', key: 'date', width: 15 }
            ];
            claims.forEach(claim => {
                worksheet.addRow(claim);
            });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=claims.xlsx');
            workbook.xlsx.write(res).then(() => res.end());
        } else if (format === 'pdf') {
            logRequest(req, 'Exporting claims to PDF');
            const doc = new PDFDocument();
            doc.pipe(res);
            doc.text('Claims Report', { align: 'center' });
            claims.forEach(claim => {
                doc.text(`MVA: ${claim.mva}`);
                doc.text(`Customer Name: ${claim.customerName}`);
                doc.text(`Description: ${claim.description}`);
                doc.text(`Status: ${claim.status}`);
                doc.text(`Date: ${new Date(claim.date).toLocaleDateString()}`);
                doc.moveDown();
            });
            doc.end();
        } else {
            logRequest(req, 'Invalid export format:', { format });
            res.status(400).json({ msg: 'Invalid format' });
        }
    } catch (err) {
        logRequest(req, 'Error exporting claims:', { error: err });
        res.status(500).json({ error: err.message }); // Handle errors
    }
});

// Route to view a specific claim by ID, with options to edit or delete, accessible by admin, manager, and employee
router.get('/:id', ensureAuthenticated, ensureRoles(['admin', 'manager', 'employee']), logActivity('Viewed claim details'), async (req, res) => {
    const claimId = req.params.id;
    logRequest(req, 'Fetching claim details with ID:', { claimId });

    try {
        const claim = await Claim.findById(claimId).exec();
        if (!claim) {
            logRequest(req, `Claim with ID ${claimId} not found`, { level: 'error' });
            return res.status(404).render('404', { message: 'Claim not found' });
        }
        logRequest(req, 'Claim details fetched:', { claim });
        res.render('claim_view', { title: 'View Claim', claim });
    } catch (err) {
        logRequest(req, 'Error fetching claim details:', { error: err });
        res.status(500).render('500', { message: 'Internal Server Error' });
    }
});

module.exports = router; // Export the router
