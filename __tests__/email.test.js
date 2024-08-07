const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');

beforeAll(async () => {
  await mongoose.connect(global.__MONGO_URI__, { useNewUrlParser: true, useUnifiedTopology: true });
  server = app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Email Routes', () => {
  it('should send an email', async () => {
    const res = await request(app)
      .post('/email/send')
      .send({
        to: 'test@example.com',
        subject: 'Test Email',
        body: 'This is a test email.'
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('msg', 'Email sent successfully');
  });
});
