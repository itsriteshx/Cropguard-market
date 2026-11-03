const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

// Import all models
const User = require('../models/User');
const ProduceListing = require('../models/ProduceListing');
const MandiRate = require('../models/MandiRate');
const Negotiation = require('../models/Negotiation');
const Order = require('../models/Order');
const AuditLog = require('../models/AuditLog');

const seedMasterDatabase = async () => {
  try {
    console.log('----------------------------------------------------');
    console.log('🌾 CropGuard Market - Master Database Seeder');
    console.log('   Ministry of Agriculture & UASD Dharwad Protocol');
    console.log('----------------------------------------------------');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('[1/7] Connected to MongoDB Atlas cluster...');

    // Clear previous operational collections
    console.log('[2/7] Cleaning previous collection records...');
    await Promise.all([
      User.deleteMany({}),
      ProduceListing.deleteMany({}),
      MandiRate.deleteMany({}),
      Negotiation.deleteMany({}),
      Order.deleteMany({}),
      AuditLog.deleteMany({})
    ]);

    // 1. Seed Core Personas / Users (FARMER, BUYER_WHOLESALE, BUYER_RETAIL, ADMIN)
    console.log('[3/7] Seeding Users with Multilingual Preferences & GeoJSON...');
    const users = await User.create([
      {
        name: 'Ramesh Patil',
        phone: '9876543210',
        email: 'ramesh.patil@uasd.agri.in',
        password: 'farmerpassword123',
        role: 'FARMER',
        languagePreference: 'kn',
        isVerified: true,
        location: {
          type: 'Point',
          coordinates: [75.3619, 15.5492], // Navalgund, Dharwad
          village: 'Navalgund Taluk',
          taluk: 'Navalgund',
          district: 'Dharwad',
          state: 'Karnataka',
          pincode: '582208'
        }
      },
      {
        name: 'Mallikarjun Patil',
        phone: '9845012345',
        email: 'mallikarjun.patil@agri.in',
        password: 'farmerpassword123',
        role: 'FARMER',
        languagePreference: 'kn',
        isVerified: true,
        location: {
          type: 'Point',
          coordinates: [74.8587, 15.8167], // Bailhongal, Belagavi
          village: 'Bailhongal',
          taluk: 'Bailhongal',
          district: 'Belagavi',
          state: 'Karnataka',
          pincode: '591102'
        }
      },
      {
        name: 'Karnataka State Co-op Federation (KSCF)',
        phone: '9811223344',
        email: 'procurement@kscf.gov.in',
        password: 'buyerpassword123',
        role: 'BUYER_WHOLESALE',
        languagePreference: 'en',
        isVerified: true,
        location: {
          type: 'Point',
          coordinates: [75.1384, 15.3647], // Hubballi APMC Corridor
          village: 'Hubballi Commercial Hub',
          taluk: 'Hubballi',
          district: 'Dharwad',
          state: 'Karnataka',
          pincode: '580020'
        }
      },
      {
        name: 'Sunil Retail Stores',
        phone: '9822334455',
        email: 'sunil.retail@gmail.com',
        password: 'buyerpassword123',
        role: 'BUYER_RETAIL',
        languagePreference: 'hi',
        isVerified: true,
        location: {
          type: 'Point',
          coordinates: [75.0078, 15.4589], // Dharwad Market Yard
          village: 'Dharwad Main',
          taluk: 'Dharwad',
          district: 'Dharwad',
          state: 'Karnataka',
          pincode: '580001'
        }
      },
      {
        name: 'UASD & ICAR Mandi Directorate',
        phone: '9800012345',
        email: 'admin.mandi@uasd.edu.in',
        password: 'adminpassword123',
        role: 'ADMIN',
        languagePreference: 'en',
        isVerified: true,
        location: {
          type: 'Point',
          coordinates: [74.9856, 15.4889], // UAS Dharwad Main Campus
          village: 'UASD Campus',
          taluk: 'Dharwad',
          district: 'Dharwad',
          state: 'Karnataka',
          pincode: '580005'
        }
      }
    ]);

    const farmerRamesh = users[0];
    const farmerMallikarjun = users[1];
    const buyerKSCF = users[2];
    const buyerSunil = users[3];
    const adminUASD = users[4];

    // 2. Seed APMC Mandi Benchmark Rates
    console.log('[4/7] Seeding APMC Mandi Benchmark Rates (UASD Corridor)...');
    const mandiRates = await MandiRate.create([
      {
        commodity: 'ONION',
        category: 'VEGETABLES',
        state: 'KARNATAKA',
        district: 'DHARWAD',
        marketCenter: 'Dharwad APMC Yard',
        minPrice: 1900,
        maxPrice: 2900,
        modalPrice: 2450,
        unit: 'QUINTAL',
        arrivalQuantity: 650
      },
      {
        commodity: 'WHEAT',
        category: 'GRAINS',
        state: 'KARNATAKA',
        district: 'DHARWAD',
        marketCenter: 'Hubballi APMC Yard',
        minPrice: 2400,
        maxPrice: 3100,
        modalPrice: 2800,
        unit: 'QUINTAL',
        arrivalQuantity: 580
      },
      {
        commodity: 'TOMATO',
        category: 'VEGETABLES',
        state: 'KARNATAKA',
        district: 'BELAGAVI',
        marketCenter: 'Belagavi APMC Yard',
        minPrice: 1400,
        maxPrice: 2300,
        modalPrice: 1950,
        unit: 'QUINTAL',
        arrivalQuantity: 420
      },
      {
        commodity: 'CHILLI',
        category: 'SPICES',
        state: 'KARNATAKA',
        district: 'HAVERI',
        marketCenter: 'Byadagi APMC Special Yard',
        minPrice: 15000,
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
        marketCenter: 'Bailhongal APMC Yard',
        minPrice: 3800,
        maxPrice: 4950,
        modalPrice: 4450,
        unit: 'QUINTAL',
        arrivalQuantity: 340
      },
      {
        commodity: 'BENGAL GRAM',
        category: 'PULSES',
        state: 'KARNATAKA',
        district: 'DHARWAD',
        marketCenter: 'Annigeri APMC Yard',
        minPrice: 5200,
        maxPrice: 6200,
        modalPrice: 5600,
        unit: 'QUINTAL',
        arrivalQuantity: 280
      },
      {
        commodity: 'MAIZE',
        category: 'GRAINS',
        state: 'KARNATAKA',
        district: 'HAVERI',
        marketCenter: 'Ranebennur APMC Yard',
        minPrice: 1950,
        maxPrice: 2400,
        modalPrice: 2150,
        unit: 'QUINTAL',
        arrivalQuantity: 720
      },
      {
        commodity: 'COTTON',
        category: 'FIBRES',
        state: 'KARNATAKA',
        district: 'DHARWAD',
        marketCenter: 'Navalgund APMC Yard',
        minPrice: 6500,
        maxPrice: 7800,
        modalPrice: 7200,
        unit: 'QUINTAL',
        arrivalQuantity: 580
      },
      {
        commodity: 'POTATO',
        category: 'VEGETABLES',
        state: 'MAHARASHTRA',
        district: 'PUNE',
        marketCenter: 'Pune APMC Gultekdi',
        minPrice: 1700,
        maxPrice: 2500,
        modalPrice: 2150,
        unit: 'QUINTAL',
        arrivalQuantity: 850
      },
      {
        commodity: 'GREEN GRAM',
        category: 'PULSES',
        state: 'KARNATAKA',
        district: 'GADAG',
        marketCenter: 'Gadag APMC Yard',
        minPrice: 5600,
        maxPrice: 6800,
        modalPrice: 6200,
        unit: 'QUINTAL',
        arrivalQuantity: 220
      }
    ]);

    // 3. Seed Farm Produce Listings (Available, Under Negotiation, Sold)
    console.log('[5/7] Seeding Farm Produce Lots with Geospatial Coordinates...');
    const listings = await ProduceListing.create([
      {
        farmer: farmerRamesh._id,
        cropName: 'Red Onion (Garva Special)',
        category: 'VEGETABLES',
        quantity: 120,
        unit: 'QUINTAL',
        pricePerUnit: 2450,
        qualityGrade: 'ORGANIC',
        harvestDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        description: 'Certified organic winter onion harvest, zero chemical curing, high shelf life suitable for wholesale storage.',
        status: 'AVAILABLE',
        location: {
          type: 'Point',
          coordinates: [75.3619, 15.5492],
          village: 'Navalgund Taluk',
          taluk: 'Navalgund',
          district: 'Dharwad',
          state: 'Karnataka',
          pincode: '582208'
        }
      },
      {
        farmer: farmerRamesh._id,
        cropName: 'Sharbati Wheat (Premium)',
        category: 'GRAINS',
        quantity: 250,
        unit: 'QUINTAL',
        pricePerUnit: 2800,
        qualityGrade: 'GRADE_A',
        harvestDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        description: 'Golden luster Sharbati grain, high protein content, harvested under UASD certified seed protocol.',
        status: 'AVAILABLE',
        location: {
          type: 'Point',
          coordinates: [75.2917, 15.2547],
          village: 'Kundgol',
          taluk: 'Kundgol',
          district: 'Hubballi',
          state: 'Karnataka',
          pincode: '581113'
        }
      },
      {
        farmer: farmerMallikarjun._id,
        cropName: 'Roma Plum Tomatoes',
        category: 'VEGETABLES',
        quantity: 85,
        unit: 'QUINTAL',
        pricePerUnit: 1950,
        qualityGrade: 'GRADE_A',
        harvestDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        description: 'Firm texture Roma plum tomatoes ideal for processing, puree manufacturing, and long haul dispatch.',
        status: 'AVAILABLE',
        location: {
          type: 'Point',
          coordinates: [74.8587, 15.8167],
          village: 'Bailhongal',
          taluk: 'Bailhongal',
          district: 'Belagavi',
          state: 'Karnataka',
          pincode: '591102'
        }
      },
      {
        farmer: farmerRamesh._id,
        cropName: 'Byadagi Chilli (Stemless)',
        category: 'SPICES',
        quantity: 45,
        unit: 'QUINTAL',
        pricePerUnit: 18500,
        qualityGrade: 'GRADE_A',
        harvestDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        description: 'GI Tagged authentic Byadagi chilli, high ASTA color value (150+), mild pungency, deep natural red.',
        status: 'AVAILABLE',
        location: {
          type: 'Point',
          coordinates: [75.4851, 14.6789],
          village: 'Byadagi Taluk',
          taluk: 'Byadagi',
          district: 'Haveri',
          state: 'Karnataka',
          pincode: '581106'
        }
      },
      {
        farmer: farmerMallikarjun._id,
        cropName: 'Yellow Soybean (JS-335)',
        category: 'OILSEEDS',
        quantity: 180,
        unit: 'QUINTAL',
        pricePerUnit: 4450,
        qualityGrade: 'GRADE_A',
        harvestDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        description: 'Cleaned and machine graded JS-335 oilseed, moisture below 9%, high oil yield certification.',
        status: 'AVAILABLE',
        location: {
          type: 'Point',
          coordinates: [74.5089, 15.8497],
          village: 'Belagavi Rural',
          taluk: 'Belagavi',
          district: 'Belagavi',
          state: 'Karnataka',
          pincode: '590001'
        }
      },
      {
        farmer: farmerRamesh._id,
        cropName: 'Bengal Gram / Chana Dal',
        category: 'PULSES',
        quantity: 140,
        unit: 'QUINTAL',
        pricePerUnit: 5600,
        qualityGrade: 'GRADE_A',
        harvestDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        description: 'Annigeri variety desi chana, uniform grain size, optimal for pulse milling and direct packaging.',
        status: 'AVAILABLE',
        location: {
          type: 'Point',
          coordinates: [75.2891, 15.4215],
          village: 'Annigeri',
          taluk: 'Annigeri',
          district: 'Dharwad',
          state: 'Karnataka',
          pincode: '582201'
        }
      },
      {
        farmer: farmerMallikarjun._id,
        cropName: 'Fresh Green Capsicum',
        category: 'VEGETABLES',
        quantity: 60,
        unit: 'QUINTAL',
        pricePerUnit: 3200,
        qualityGrade: 'ORGANIC',
        harvestDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        description: 'Greenhouse polyhouse grown sweet bell peppers, zero pesticide residue, crisp grade export quality.',
        status: 'AVAILABLE',
        location: {
          type: 'Point',
          coordinates: [74.8587, 15.8167],
          village: 'Bailhongal',
          taluk: 'Bailhongal',
          district: 'Belagavi',
          state: 'Karnataka',
          pincode: '591102'
        }
      },
      {
        farmer: farmerRamesh._id,
        cropName: 'Hybrid Red Tomato',
        category: 'VEGETABLES',
        quantity: 350,
        unit: 'KG',
        pricePerUnit: 26,
        qualityGrade: 'GRADE_A',
        harvestDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        description: 'Fresh farmgate tomatoes, harvested yesterday, ready for local retail distribution.',
        status: 'UNDER_NEGOTIATION',
        location: {
          type: 'Point',
          coordinates: [75.0078, 15.4589],
          village: 'Dharwad Rural',
          taluk: 'Dharwad',
          district: 'Dharwad',
          state: 'Karnataka',
          pincode: '580007'
        }
      }
    ]);

    // 4. Seed Negotiations with Multi-Turn Bid History
    console.log('[6/7] Seeding Live Negotiation Bargaining Sessions...');
    const negotiations = await Negotiation.create([
      {
        listing: listings[0]._id, // Red Onion
        buyer: buyerKSCF._id,
        farmer: farmerRamesh._id,
        quantity: 120,
        originalListingPrice: 2450,
        currentOfferedPrice: 2450,
        currentTurn: 'BUYER',
        status: 'ACCEPTED',
        agreedPrice: 2450,
        agreedTotalAmount: 294000,
        bidHistory: [
          {
            bidder: buyerKSCF._id,
            bidderRole: 'BUYER',
            pricePerUnit: 2350,
            note: 'Bulk institutional purchase offer for KSCF state depots.',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000)
          },
          {
            bidder: farmerRamesh._id,
            bidderRole: 'FARMER',
            pricePerUnit: 2450,
            note: 'Direct organic lot benchmarked against Dharwad APMC floor.',
            timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000)
          },
          {
            bidder: buyerKSCF._id,
            bidderRole: 'BUYER',
            pricePerUnit: 2450,
            note: 'Agreed at APMC modal rate with zero middleman commission deduction.',
            timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000)
          }
        ]
      },
      {
        listing: listings[7]._id, // Hybrid Red Tomato
        buyer: buyerSunil._id,
        farmer: farmerRamesh._id,
        quantity: 100,
        originalListingPrice: 26,
        currentOfferedPrice: 24,
        currentTurn: 'FARMER',
        status: 'OPEN',
        bidHistory: [
          {
            bidder: buyerSunil._id,
            bidderRole: 'BUYER',
            pricePerUnit: 24,
            note: 'Offering ₹24/kg for retail morning intake.',
            timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000)
          }
        ]
      }
    ]);

    // 5. Seed Orders Across Lifecycle (Escrow Held, Dispatched, Settled)
    console.log('[7/7] Seeding Bulk Orders with Escrow Timelines & Audit Logs...');
    const orders = await Order.create([
      {
        orderNumber: 'CG-ORD-2026-1001',
        negotiation: negotiations[0]._id,
        listing: listings[0]._id,
        buyer: buyerKSCF._id,
        farmer: farmerRamesh._id,
        cropName: 'Red Onion (Garva Special)',
        quantity: 120,
        unit: 'QUINTAL',
        unitPrice: 2450,
        totalAmount: 294000,
        middlemanFeeSaved: 29400,
        orderStatus: 'ESCROW_HELD',
        paymentStatus: 'ESCROW_SECURED',
        paymentDetails: {
          paymentMethod: 'UPI',
          transactionId: 'UPI-KSCF-ESCROW-892104',
          escrowSecuredAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
        },
        deliveryAddress: {
          street: 'KSCF Central Cold Storage Facility',
          village: 'APMC Yard Hubballi',
          district: 'Dharwad',
          state: 'Karnataka',
          pincode: '580025',
          contactPhone: '9811223344'
        },
        timeline: [
          {
            status: 'PLACED',
            timestamp: new Date(Date.now() - 14 * 60 * 60 * 1000),
            note: 'Wholesale lot contract initiated via CropGuard Market.',
            updatedBy: buyerKSCF._id
          },
          {
            status: 'ESCROW_HELD',
            timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
            note: '₹2,94,000 locked into ICAR/UASD supervised escrow vault.',
            updatedBy: adminUASD._id
          }
        ]
      },
      {
        orderNumber: 'CG-ORD-2026-1002',
        listing: listings[1]._id,
        buyer: buyerKSCF._id,
        farmer: farmerRamesh._id,
        cropName: 'Sharbati Wheat (Premium)',
        quantity: 200,
        unit: 'QUINTAL',
        unitPrice: 2800,
        totalAmount: 560000,
        middlemanFeeSaved: 56000,
        orderStatus: 'DISPATCHED',
        paymentStatus: 'ESCROW_SECURED',
        paymentDetails: {
          paymentMethod: 'NETBANKING',
          transactionId: 'NEFT-KSCF-TRANS-402911',
          escrowSecuredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        deliveryAddress: {
          street: 'State Grain Storage Depot #4',
          village: 'Navalgund Highway',
          district: 'Dharwad',
          state: 'Karnataka',
          pincode: '582208',
          contactPhone: '9811223344'
        },
        timeline: [
          {
            status: 'PLACED',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            note: 'Contract confirmed.',
            updatedBy: buyerKSCF._id
          },
          {
            status: 'ESCROW_HELD',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            note: 'Escrow vault funded with ₹5,60,000.',
            updatedBy: adminUASD._id
          },
          {
            status: 'DISPATCHED',
            timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000),
            note: 'Produce loaded on Agri-freight vehicle KA-25-EA-9021.',
            updatedBy: farmerRamesh._id
          }
        ]
      },
      {
        orderNumber: 'CG-ORD-2026-1003',
        listing: listings[2]._id,
        buyer: buyerKSCF._id,
        farmer: farmerMallikarjun._id,
        cropName: 'Roma Plum Tomatoes',
        quantity: 80,
        unit: 'QUINTAL',
        unitPrice: 1950,
        totalAmount: 156000,
        middlemanFeeSaved: 15600,
        orderStatus: 'SETTLED',
        paymentStatus: 'PAID_TO_FARMER',
        paymentDetails: {
          paymentMethod: 'UPI',
          transactionId: 'UPI-SETTLE-6019284',
          escrowSecuredAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          settledAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        },
        deliveryAddress: {
          street: 'Belagavi Food Processing Cluster',
          village: 'Udyambag',
          district: 'Belagavi',
          state: 'Karnataka',
          pincode: '590008',
          contactPhone: '9811223344'
        },
        timeline: [
          {
            status: 'PLACED',
            timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
            note: 'Contract placed.'
          },
          {
            status: 'ESCROW_HELD',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            note: 'Escrow funded.'
          },
          {
            status: 'DISPATCHED',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            note: 'Produce dispatched from Bailhongal.'
          },
          {
            status: 'DELIVERED',
            timestamp: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000),
            note: 'Inspected and certified Grade A upon delivery.'
          },
          {
            status: 'SETTLED',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            note: '₹1,56,000 disbursed directly to farmer bank account with zero fee cut.',
            updatedBy: adminUASD._id
          }
        ]
      }
    ]);

    // 6. Seed Statutory Audit Logs
    await AuditLog.create([
      {
        action: 'APMC_BENCHMARK_VERIFIED',
        actor: adminUASD._id,
        actorRole: 'ADMIN',
        targetEntity: 'PRODUCE_LISTING',
        targetId: listings[0]._id,
        title: 'Floor Price Benchmark Cleared',
        description: 'Listing verified against Hubballi APMC modal rate corridor of ₹2,450/qtl.',
        financialSnapshot: {
          dealAmount: 294000,
          middlemanFeeSaved: 29400,
          apmcBenchmarkRate: 2450,
          settlementStatus: 'COMPLIANT'
        },
        complianceAuthority: 'UASD APMC Cell'
      },
      {
        action: 'COMMISSION_EXEMPTION_APPLIED',
        actor: buyerKSCF._id,
        actorRole: 'BUYER_WHOLESALE',
        targetEntity: 'ORDER',
        targetId: orders[0]._id,
        title: 'Zero Arhatiya Commission Exemption',
        description: '10.0% traditional middleman cut retained by producer Ramesh Patil.',
        financialSnapshot: {
          dealAmount: 294000,
          middlemanFeeSaved: 29400,
          apmcBenchmarkRate: 2450,
          settlementStatus: 'VERIFIED'
        },
        complianceAuthority: 'Ministry of Agriculture Norms'
      },
      {
        action: 'ESCROW_SECURED',
        actor: buyerKSCF._id,
        actorRole: 'BUYER_WHOLESALE',
        targetEntity: 'ORDER',
        targetId: orders[1]._id,
        title: 'Escrow Vault Secured',
        description: '₹5,60,000 institutional funds locked in multi-sig escrow prior to transport.',
        financialSnapshot: {
          dealAmount: 560000,
          middlemanFeeSaved: 56000,
          apmcBenchmarkRate: 2800,
          settlementStatus: 'SECURED'
        },
        complianceAuthority: 'CropGuard Escrow Framework'
      },
      {
        action: 'SETTLEMENT_RELEASED',
        actor: adminUASD._id,
        actorRole: 'ADMIN',
        targetEntity: 'ORDER',
        targetId: orders[2]._id,
        title: 'Direct Farmer Settlement Completed',
        description: '₹1,56,000 paid to Mallikarjun Patil with verified zero payment deduction.',
        financialSnapshot: {
          dealAmount: 156000,
          middlemanFeeSaved: 15600,
          apmcBenchmarkRate: 1950,
          settlementStatus: 'PAID'
        },
        complianceAuthority: 'ICAR Fair Trade Directorate'
      }
    ]);

    console.log('----------------------------------------------------');
    console.log('✅ Master Database Seeding Completed Successfully!');
    console.log(`   - Users Seeded:        ${users.length}`);
    console.log(`   - Produce Listings:    ${listings.length}`);
    console.log(`   - Mandi Rates:         ${mandiRates.length}`);
    console.log(`   - Negotiations:        ${negotiations.length}`);
    console.log(`   - Orders:              ${orders.length}`);
    console.log(`   - Audit Khata Logs:    4`);
    console.log('----------------------------------------------------');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Master Seeding Error:', error);
    process.exit(1);
  }
};

seedMasterDatabase();
