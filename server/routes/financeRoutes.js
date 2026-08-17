const router = require('express').Router();
const {
  listExpenses,
  createExpense,
  deleteExpense,
  getSummary,
  setBudget,
  listStockQuotes,
  getStockInsight,
} = require('../controllers/financeController');
const verifyToken = require('../middleware/verifyToken');

router.use(verifyToken);
router.get('/expenses', listExpenses);
router.post('/expenses', createExpense);
router.delete('/expenses/:id', deleteExpense);
router.get('/summary', getSummary);
router.put('/budget', setBudget);
router.get('/stocks', listStockQuotes);
router.get('/stocks/:symbol/insight', getStockInsight);

module.exports = router;
