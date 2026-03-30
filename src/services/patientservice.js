// services/PatientService.js
import supabase from '../config/supabaseclient';

class PatientService {
    /**
     * Add a new patient with all relevant info
     * @param {Object} formData - all form fields from AddPatient.jsx
     * @returns {Object} - { success: boolean, patientId: number, message: string }
     */
    static async addPatient(formData) {
        try {
            //Insert into Users table
            const { data: user, error: userError } = await supabase
                .from('Users')
                .insert([{
                    email_address: formData.email,
                    password: formData.contactNumber,
                    usertype: 1 
                }])
                .select('id')
                .single();

            if (userError) throw userError;

            const patientId = user.id;

            // Insert basic patient info
            const { error: basicError } = await supabase
                .from('patient_basic_info')
                .insert([{
                    id: patientId,
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    suffix: formData.suffix,
                    date_of_birth: formData.dob,
                    civil_status: formData.civilStatus,
                    house_no: formData.address,
                    municipality: formData.municipality,
                    barangay: formData.barangay,
                    province: formData.province,
                    philhealthnumber: formData.philhealth || 0
                }]);
            if (basicError) throw basicError;

            //Insert pregnancy info
            const { error: pregError } = await supabase
                .from('pregnancy_info')
                .insert([{
                    patient_id: patientId,
                    pregn_postp: formData.pregnancyStatus,
                    LMD: formData.lmp || null,
                    EDD: formData.edd || null,
                    pregnancy_type: formData.pregnancyType,
                    placeofdelivery: formData.plannedDeliveryPlace,
                    created_by: patientId
                }]);
            if (pregError) throw pregError;

            //Insert default patient status
            const { error: statusError } = await supabase
                .from('patient_status')
                .insert([{
                    patient_id: patientId,
                    status_type: 1, //default status type
                    status_date: new Date().toISOString().split('T')[0],
                    notes: 'New patient added'
                }]);
            if (statusError) throw statusError;

            return { success: true, patientId, message: 'Patient successfully added.' };

        } 
        catch (error) {
            console.error('PatientService.addPatient error:', error);
            return { success: false, patientId: null, message: error.message || 'Unknown error' };
        }
    }
}

export default PatientService;