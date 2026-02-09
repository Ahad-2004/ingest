const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// MongoDB Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
        process.exit(1);
    }
};

connectDB();

// Schema
const QuestionSchema = new mongoose.Schema({
    text: String,
    type: String,
    options: [{
        text: String,
        isCorrect: Boolean,
        image: String,
        hasDiagram: Boolean,
        boundingBox: [Number]
    }],
    subject: String,
    board: String,
    standard: String,
    chapter: String,
    topic: String,
    section: String,
    marks: Number,
    difficulty: String,
    correctAnswerText: String,
    numericalAnswer: String,
    image: String, // Firebase URL
    hasImage: Boolean,
    source: String,
    createdAt: { type: Date, default: Date.now }
});

const Question = mongoose.model('Question', QuestionSchema, 'question_bank');

// Routes
app.post('/api/ingest', async (req, res) => {
    try {
        const questions = req.body.questions;
        if (!Array.isArray(questions)) {
            return res.status(400).json({ msg: 'Invalid data format' });
        }

        // Insert questions
        const result = await Question.insertMany(questions);
        res.json({ msg: 'Success', count: result.length, ids: result.map(q => q._id) });
    } catch (error) {
        console.error('Ingest Error:', error);
        res.status(500).json({ msg: 'Server Error', error: error.message });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
