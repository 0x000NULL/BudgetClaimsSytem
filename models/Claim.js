const mongoose = require('mongoose');

const ClaimSchema = new mongoose.Schema({
    mva: {
        type: String,
        required: false
    },
    customerName: {
        type: String,
        required: false
    },
    customerNumber: {
        type: String,
        required: false
    },
    customerEmail: {
        type: String,
        required: false
    },
    customerAddress: {
        type: String,
        required: false
    },
    customerDriversLicense: {
        type: String,
        required: false
    },
    carMake: {
        type: String,
        required: false
    },
    carModel: {
        type: String,
        required: false
    },
    carYear: {
        type: String,
        required: false
    },
    carColor: {
        type: String,
        required: false
    },
    carVIN: {
        type: String,
        required: false
    },
    accidentDate: {
        type: Date,
        required: false
    },
    billable: {
        type: Boolean,
        required: false
    },
    isRenterAtFault: {
        type: Boolean,
        required: false
    },
    damagesTotal: {
        type: Number,
        required: false
    },
    bodyShopName: {
        type: String,
        required: false
    },
    raNumber: {
        type: String,
        required: false
    },
    insuranceCarrier: {
        type: String,
        required: false
    },
    insuranceAdjuster: {
        type: String,
        required: false
    },
    insuranceEmail: {
        type: String,
        required: false
    },
    insurancePhoneNumber: {
        type: String,
        required: false
    },
    insuranceFaxNumber: {
        type: String,
        required: false
    },
    insuranceAddress: {
        type: String,
        required: false
    },
    insurancePolicyNumber: {
        type: String,
        required: false
    },
    insuranceClaimNumber: {
        type: String,
        required: false
    },
    thirdPartyName: {
        type: String,
        required: false
    },
    thirdPartyAddress: {
        type: String,
        required: false
    },
    thirdPartyPhoneNumber: {
        type: String,
        required: false
    },
    thirdPartyInsuranceName: {
        type: String,
        required: false
    },
    thirdPartyAdjusterName: {
        type: String,
        required: false
    },
    thirdPartyPolicyNumber: {
        type: String,
        required: false
    },
    thirdPartyClaimNumber: {
        type: String,
        required: false
    },
    rentingLocation: {
        type: String,
        enum: ['LAS Airport', 'Henderson Executive Airport', 'Toyota Las Vegas', 'Center Strip', 'Losee', 'Tropicana', 'West Sahara', 'Gibson', 'Golden Nugget'],
        required: false
    },
    ldwAccepted: {
        type: Boolean,
        required: false
    },
    policeDepartment: {
        type: String,
        required: false
    },
    policeReportNumber: {
        type: String,
        required: false
    },
    claimCloseDate: {
        type: Date,
        required: false
    },
    vehicleOdometer: {
        type: Number,
        required: false
    },
    description: {
        type: String,
        required: false
    },
    damageType: {
        type: [String],
        enum: ['Heavy hit', 'Light hit', 'Mystery', 'Tire', 'Windshield', 'Undercarriage', 'Mechanical', 'Interior', 'Trunk', 'Gas/Tank', 'Roof', 'Driver Front Door', 'Driver Rear Door', 'Passenger Rear Door', 'Passenger Front Door', 'Left Rear Bumper', 'Right Rear Bumper', 'Rear Bumper', 'Left Front Bumper', 'Right Front Bumper', 'Front Bumper', 'Headlamp', 'Tail Light', 'Window', 'Left Quarter Panel', 'Right Quarter Panel', 'Right Fender', 'Left Fender', 'Hood', 'Mirrors', 'Left Rocker', 'Right Rocker', 'Vandalism', 'Stolen', 'Totaled', 'Total - Flood', 'Total - Fire', 'Total - Hail', 'Total - Biohazard', 'Left Pillar', 'Right Pillar', 'Stolen - Recovered', 'Employee'],
        required: false
    },
    status: {
        type: String,
        enum: ['Closed', 'Vince Pre-Sub', 'Vince Sub', 'Deonte Pre-Sub', 'Deonte Sub', 'Stef Claim', 'Bodyshop', 'LDW Discharge', 'Stef Pre-Litigation', 'Stef Litigation', 'Tina Pre-Litigation', 'Tina Litigation', 'Collections', 'Collections Review'],
        required: false
    },
    files: {
        incidentReports: [String],
        correspondence: [String],
        rentalAgreement: [String],
        policeReport: [String],
        invoices: [String],
        photos: [String]
    },
    versions: {
        type: [Object]
    },
    date: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Claim', ClaimSchema);
