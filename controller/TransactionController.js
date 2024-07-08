const Transaction = require('../model/TrasactionModel');
const axios = require('axios');

const initializeDatabase = async (req, res) => {
    try {
        const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
        await Transaction.insertMany(response.data);
        res.send('Database initialized with seed data');
    } catch (error) {
        res.status(500).send('Error initializing database');
    }
};

const listTransactions = async (req, res) => {
    const { page = 1, perPage = 10, search = '', month } = req.query;
    const regex = new RegExp(search, 'i');
    const query = {
        dateOfSale: { $regex: `${month}-` },
        $or: [
            { title: regex },
            { description: regex },
            { price: regex },
        ],
    };

    try {
        const transactions = await Transaction.find(query)
            .skip((page - 1) * perPage)
            .limit(parseInt(perPage));
        res.json(transactions);
    } catch (error) {
        res.status(500).send('Error fetching transactions');
    }
};

const getStatistics = async (req, res) => {
    const { month } = req.query;
    try {
        const totalSaleAmount = await Transaction.aggregate([
            { $match: { dateOfSale: { $regex: `${month}-` } } },
            { $group: { _id: null, totalAmount: { $sum: '$price' } } },
        ]);
        const totalSoldItems = await Transaction.countDocuments({ dateOfSale: { $regex: `${month}-` }, sold: true });
        const totalNotSoldItems = await Transaction.countDocuments({ dateOfSale: { $regex: `${month}-` }, sold: false });

        res.json({
            totalSaleAmount: totalSaleAmount[0]?.totalAmount || 0,
            totalSoldItems,
            totalNotSoldItems,
        });
    } catch (error) {
        res.status(500).send('Error fetching statistics');
    }
};

const getBarChart = async (req, res) => {
    const { month } = req.query;
    const priceRanges = [
        { min: 0, max: 100 },
        { min: 101, max: 200 },
        { min: 201, max: 300 },
        { min: 301, max: 400 },
        { min: 401, max: 500 },
        { min: 501, max: 600 },
        { min: 601, max: 700 },
        { min: 701, max: 800 },
        { min: 801, max: 900 },
        { min: 901, max: Infinity },
    ];

    try {
        const result = await Promise.all(priceRanges.map(async range => {
            const count = await Transaction.countDocuments({
                dateOfSale: { $regex: `${month}-` },
                price: { $gte: range.min, $lte: range.max },
            });
            return { range: `${range.min}-${range.max}`, count };
        }));
        res.json(result);
    } catch (error) {
        res.status(500).send('Error fetching bar chart data');
    }
};

const getPieChart = async (req, res) => {
    const { month } = req.query;
    try {
        const result = await Transaction.aggregate([
            { $match: { dateOfSale: { $regex: `${month}-` } } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
        ]);
        res.json(result.map(r => ({ category: r._id, count: r.count })));
    } catch (error) {
        res.status(500).send('Error fetching pie chart data');
    }
};

const getCombinedData = async (req, res) => {
    const { month } = req.query;
    const priceRanges = [
        { min: 0, max: 100 },
        { min: 101, max: 200 },
        { min: 201, max: 300 },
        { min: 301, max: 400 },
        { min: 401, max: 500 },
        { min: 501, max: 600 },
        { min: 601, max: 700 },
        { min: 701, max: 800 },
        { min: 801, max: 900 },
        { min: 901, max: Infinity },
    ];

    try {
        const [transactions, statistics, barChart, pieChart] = await Promise.all([
            Transaction.find({ dateOfSale: { $regex: `${month}-` } }),
            Transaction.aggregate([
                { $match: { dateOfSale: { $regex: `${month}-` } } },
                { $group: { _id: null, totalAmount: { $sum: '$price' }, totalSoldItems: { $sum: { $cond: ['$sold', 1, 0] } }, totalNotSoldItems: { $sum: { $cond: ['$sold', 0, 1] } } } }
            ]),
            Promise.all(priceRanges.map(async range => {
                const count = await Transaction.countDocuments({
                    dateOfSale: { $regex: `${month}-` },
                    price: { $gte: range.min, $lte: range.max },
                });
                return { range: `${range.min}-${range.max}`, count };
            })),
            Transaction.aggregate([
                { $match: { dateOfSale: { $regex: `${month}-` } } },
                { $group: { _id: '$category', count: { $sum: 1 } } },
            ]),
        ]);

        res.json({
            transactions,
            statistics: statistics[0],
            barChart,
            pieChart: pieChart.map(r => ({ category: r._id, count: r.count })),
        });
    } catch (error) {
        res.status(500).send('Error fetching combined data');
    }
};

module.exports = {
    initializeDatabase,
    listTransactions,
    getStatistics,
    getBarChart,
    getPieChart,
    getCombinedData,
};
