const express = require('express');
const router = express.Router();

const {
  getAllLanguages,
  getCropLexicon,
  getLanguageBundle
} = require('../controllers/languageController');

// Public language routes
router.get('/', getAllLanguages);
router.get('/crops', getCropLexicon);
router.get('/translations/:lang', getLanguageBundle);

module.exports = router;
