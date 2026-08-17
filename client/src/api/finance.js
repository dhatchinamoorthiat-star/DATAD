import api from './axios';

export const listExpenses = (month) => api.get('/finance/expenses', { params: { month } });
export const createExpense = (data) => api.post('/finance/expenses', data);
export const deleteExpense = (id) => api.delete(`/finance/expenses/${id}`);
export const getSummary = (month) => api.get('/finance/summary', { params: { month } });
export const setBudget = (monthlyAmount) => api.put('/finance/budget', { monthlyAmount });
export const listStockQuotes = (sector) => api.get('/finance/stocks', { params: { sector } });
export const getStockInsight = (symbol) => api.get(`/finance/stocks/${encodeURIComponent(symbol)}/insight`);
