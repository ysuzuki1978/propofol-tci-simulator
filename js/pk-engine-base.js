/**
 * Base class of the four engines: holds the patient and the Eleveld PK/PD
 * parameters derived from it. The parameters live on the engine only; the
 * Patient object is not modified.
 */
class PKEngineBase {
    constructor() {
        this.patient = null;
        this.pkParams = null;  // PKParameters (volumes, clearances, rate constants, ke0)
        this.pdParams = null;  // PDParameters for the BIS model
    }

    setPatient(patient) {
        const { pk, pd } = EleveldPKPDCalculator.resolveParameters(patient);
        this.patient = patient;
        this.pkParams = pk;
        this.pdParams = pd;
    }
}

if (typeof window !== 'undefined') {
    window.PKEngineBase = PKEngineBase;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PKEngineBase };
}
