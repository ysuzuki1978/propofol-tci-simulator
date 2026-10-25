/**
 * PK Integrator
 * 3-compartment + effect-site ODE, single RK4 step shared by all engines.
 *
 * State (a1, a2, a3 in mg; ce in ug/mL):
 *   da1/dt = u - (k10 + k12 + k13) a1 + k21 a2 + k31 a3
 *   da2/dt = k12 a1 - k21 a2
 *   da3/dt = k13 a1 - k31 a3
 *   dce/dt = ke0 (a1 / v1 - ce)
 * u is the infusion rate in mg/min, constant over the step. A bolus is not a
 * rate: add it to a1 before stepping.
 */
class PKIntegrator {
    /**
     * @param {{a1:number,a2:number,a3:number,ce:number}} state
     * @param {{k10:number,k12:number,k21:number,k13:number,k31:number,ke0:number,v1:number}} pk rate constants in 1/min, v1 in L
     * @param {number} infusionMgPerMin infusion rate in mg/min
     * @param {number} dtMin step in minutes
     * @returns {{a1:number,a2:number,a3:number,ce:number}} new state
     */
    static rk4Step(state, pk, infusionMgPerMin, dtMin) {
        const { k10, k12, k21, k13, k31, ke0, v1 } = pk;

        const derivatives = (s) => ({
            da1: infusionMgPerMin - (k10 + k12 + k13) * s.a1 + k21 * s.a2 + k31 * s.a3,
            da2: k12 * s.a1 - k21 * s.a2,
            da3: k13 * s.a1 - k31 * s.a3,
            dce: ke0 * (s.a1 / v1 - s.ce)
        });
        const advance = (s, d, h) => ({
            a1: s.a1 + h * d.da1,
            a2: s.a2 + h * d.da2,
            a3: s.a3 + h * d.da3,
            ce: s.ce + h * d.dce
        });

        const k1 = derivatives(state);
        const k2 = derivatives(advance(state, k1, 0.5 * dtMin));
        const k3 = derivatives(advance(state, k2, 0.5 * dtMin));
        const k4 = derivatives(advance(state, k3, dtMin));

        const w = dtMin / 6.0;
        return {
            a1: state.a1 + w * (k1.da1 + 2 * k2.da1 + 2 * k3.da1 + k4.da1),
            a2: state.a2 + w * (k1.da2 + 2 * k2.da2 + 2 * k3.da2 + k4.da2),
            a3: state.a3 + w * (k1.da3 + 2 * k2.da3 + 2 * k3.da3 + k4.da3),
            ce: state.ce + w * (k1.dce + 2 * k2.dce + 2 * k3.dce + k4.dce)
        };
    }
}

if (typeof window !== 'undefined') {
    window.PKIntegrator = PKIntegrator;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PKIntegrator };
}
