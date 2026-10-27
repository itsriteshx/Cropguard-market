const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const MandiRate = require('../models/MandiRate');

const seedData = [
  // Dharwad / Hubballi APMC (Karnataka - UASD Dharwad Region)
  {
    commodity: 'TOMATO',
    category: 'VEGETABLES',
    state: 'KARNATAKA',
    district: 'DHARWAD',
    marketCenter: 'Hubballi APMC Yard',
    minPrice: 1800,
    maxPrice: 2800,
    modalPrice: 2400,
    unit: 'QUINTAL',
    arrivalQuantity: 420
  },
  {
    commodity: 'ONION',
    category: 'VEGETABLES',
    state: 'KARNATAKA',
    district: 'DHARWAD',
    marketCenter: 'Hubballi APMC Yard',
    minPrice: 2200,
    maxPrice: 3500,
    modalPrice: 2900,
    unit: 'QUINTAL',
    arrivalQuantity: 650
  },
  {
    commodity: 'WHEAT',
    category: 'GRAINS',
    state: 'KARNATAKA',
    district: 'DHARWAD',
    marketCenter: 'Dharwad Market Yard',
    minPrice: 2350,
    maxPrice: 2750,
    modalPrice: 2550,
    unit: 'QUINTAL',
    arrivalQuantity: 310
  },
  {
    commodity: 'COTTON',
    category: 'FIBRES',
    state: 'KARNATAKA',
    district: 'DHARWAD',
    marketCenter: 'Navalgund APMC',
    minPrice: 6500,
    maxPrice: 7800,
    modalPrice: 7200,
    unit: 'QUINTAL',
    arrivalQuantity: 580
  },
  {
    commodity: 'CHILLI',
    category: 'SPICES',
    state: 'KARNATAKA',
    district: 'DHARWAD',
    marketCenter: 'Byadagi-Hubballi APMC',
    minPrice: 14000,
    maxPrice: 22000,
    modalPrice: 18500,
    unit: 'QUINTAL',
    arrivalQuantity: 890
  },
  {
    commodity: 'SOYBEAN',
    category: 'OILSEEDS',
    state: 'KARNATAKA',
    district: 'BELAGAVI',
    marketCenter: 'Belagavi Main Yard',
    minPrice: 4100,
    maxPrice: 4700,
    modalPrice: 4450,
    unit: 'QUINTAL',
    arrivalQuantity: 340
  },
  {
    commodity: 'MAIZE',
    category: 'GRAINS',
    state: 'KARNATAKA',
    district: 'HAVERI',
    marketCenter: 'Ranebennur APMC',
    minPrice: 1950,
    maxPrice: 2300,
    modalPrice: 2150,
    unit: 'QUINTAL',
    arrivalQuantity: 720
  },
  {
    commodity: 'BENGAL GRAM',
    category: 'PULSES',
    state: 'KARNATAKA',
    district: 'DHARWAD',
    marketCenter: 'Annigeri APMC',
    minPrice: 5200,
    maxPrice: 5900,
    modalPrice: 5600,
    unit: 'QUINTAL',
    arrivalQuantity: 280
  },
  // Maharashtra APMC
  {
    commodity: 'ONION',
    category: 'VEGETABLES',
    state: 'MAHARASHTRA',
    district: 'NASHIK',
    marketCenter: 'Lasalgaon Mandi',
    minPrice: 2100,
    maxPrice: 3400,
    modalPrice: 2800,
    unit: 'QUINTAL',
    arrivalQuantity: 1850
  },
  {
    commodity: 'TOMATO',
    category: 'VEGETABLES',
    state: 'MAHARASHTRA',
    district: 'PUNE',
    marketCenter: 'Narayangaon Mandi',
    minPrice: 1600,
    maxPrice: 2600,
    modalPrice: 2200,
    unit: 'QUINTAL',
    arrivalQuantity: 910
  },
  {
    commodity: 'SOYBEAN',
    category: 'OILSEEDS',
    state: 'MAHARASHTRA',
    district: 'INDORE',
    marketCenter: 'Indore Mandi',
    minPrice: 4200,
    maxPrice: 4850,
    modalPrice: 4500,
    unit: 'QUINTAL',
    arrivalQuantity: 1200
  },
  {
    commodity: 'POTATO',
    category: 'VEGETABLES',
    state: 'UTTAR PRADESH',
    district: 'AGRA',
    marketCenter: 'Agra Mandi',
    minPrice: 1200,
    maxPrice: 1800,
    modalPrice: 1550,
    unit: 'QUINTAL',
    arrivalQuantity: 1450
  }
];

const seedMandiRates = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is missing in .env');
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB Atlas for seeding APMC Mandi rates...');

    await MandiRate.deleteMany({});
    console.log('Cleared existing MandiRate records.');

    const created = await MandiRate.insertMany(seedData);
    console.log(`Successfully seeded ${created.length} APMC benchmark records.`);

    await mongoose.disconnect();
    console.log('Mandi seeder completed successfully.');
  } catch (error) {
    console.error('Error seeding Mandi rates:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  seedMandiRates();
}

module.exports = { seedData, seedMandiRates };
