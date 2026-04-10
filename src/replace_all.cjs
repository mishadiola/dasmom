const fs = require('fs');
const path = require('path');

const files = [
    'src/layouts/DashboardLayout.jsx',
    'src/pages/Analytics/Analytics.jsx',
    'src/pages/Deliveries/DeliveryOutcomes.jsx',
    'src/pages/Postpartum/PostpartumRecords.jsx',
    'src/pages/Vaccinations/Vaccinations.jsx',
    'src/pages/Settings/Settings.jsx',
    'src/pages/Patients/PatientsList.jsx',
    'src/pages/Patients/PatientProfile.jsx',
    'src/pages/Patients/AddPatient.jsx',
    'src/pages/Prenatal/AddPrenatalVisit.jsx',
    'src/pages/Newborns/NewbornTracking.jsx',
    'src/pages/MotherDashboard/UserSettings.jsx',
    'src/pages/MotherDashboard/UserAccount.jsx',
    'src/pages/MotherDashboard/PregnancyDeliveryInfo.jsx',
    'src/pages/MotherDashboard/MyAppointments.jsx',
    'src/pages/Dashboard/Dashboard.jsx',
    'src/components/Prenatal/ScheduledVisitModal.jsx',
    'src/pages/HighRisk/HighRiskCases.jsx',
    'src/styles/pages/Settings.css',
    'src/styles/pages/PostpartumRecords.css',
    'src/styles/pages/HighRiskCases.css',
    'src/styles/pages/Dashboard.css',
    'src/styles/pages/StationReports.css'
];

for (const file of files) {
    if (fs.existsSync(file)) {
        let text = fs.readFileSync(file, 'utf8');
        
        // Don't replace if it's explicitly querying Supabase or it's a specific logic string,
        // Actually, since these are mostly JSX UI files, replacing 'barangay' with 'station'
        // might replace state variables like `b.barangay`. We WANT that, as long as we map
        // it from the service correctly!
        
        text = text.replace(/Barangays/g, 'Stations');
        text = text.replace(/barangays/g, 'stations');
        text = text.replace(/Barangay/g, 'Station');
        text = text.replace(/barangay/g, 'station');
        text = text.replace(/Brgy\./g, 'Station');
        text = text.replace(/Brgy/g, 'Station');
        text = text.replace(/brgy/g, 'station');
        text = text.replace(/BARANGAYS/g, 'STATIONS');
        
        fs.writeFileSync(file, text);
        console.log(`Updated ${file}`);
    } else {
        console.log(`Not found: ${file}`);
    }
}
