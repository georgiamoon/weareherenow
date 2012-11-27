 
/** 
    We Are Here Now Project (c) 2012 SIDL & Bryan Valentini 
    NY State Plane Converter 
*/

const PI = Math.PI;
const DEG_TO_RAD = PI / 180.0; //number of radians in a degree

function radians(f) {
    return f * DEG_TO_RAD;
}

function calcM(theta, e) {
    sinTheta = e * Math.sin(radians(theta));
    return Math.cos(radians(theta)) / Math.pow(1 - sinTheta * sinTheta, .5);
}

function calcT(theta, e) {
    radiansTheta = radians(theta);
    numer = Math.tan((PI / 4) - (radiansTheta / 2));

    sinTheta = e * Math.sin(radiansTheta);
    num2 = 1 - sinTheta;
    denom2 = 1 + sinTheta;
    denom = Math.pow((num2 / denom2), e / 2);
    return numer / denom;
}


/**
* Converts latitude, longitude to an array of the [x (East), y (North)] NYLI SP coordinates.
* @param lat  the latitude in degrees, decimal format
* @param lng  the longitude in degrees, decimal format
* @return [x,y] state plane coordinate values (in US survey feet).
*/
var StatePlaneConverter = function(lat, lng) {
    a = 6378137;                     // semi-major radius of ellipsoid, meters (NAD 83)
    f = 0.003352810681225;           // flattening, 1/f = 298.25722
    theta0 = 40.16666666666666;
    theta1 = 40.16666666666666;
    theta2 = 40.66666666666666;

    e = Math.pow(((2 * f) - (f * f)), .5);
    m1 = calcM(theta1, e);
    m2 = calcM(theta2, e);
    t = calcT(lat, e);
    t0 = calcT(theta0, e);
    t1 = calcT(theta1, e);
    t2 = calcT(theta2, e);
    n = (Math.log(m1) - Math.log(m2)) / (Math.log(t1) - Math.log(t2));
    F = (m1 / (n * Math.pow(t1, n)));
    rho0 = a * F * Math.pow(t0, n);

    gamma = n * (radians(lng) - radians(-74));
    rho = a * F * Math.pow(t, n);

    N = rho0 - (rho * Math.cos(gamma));
    N *= 3.2808399;
    E = 300000 + rho * Math.sin(gamma);
    E *= 3.2808399;
    xy = [E, N];
    /*
    console.log("f:" + f + "\ne:" + e + "\nm1:" + m1
        + "\nm2:" + m2 + "\nt1:" + t1 + "\nt2:" + t2
        + "\nn:" + n + "\nF:" + F + "\nrho:" + rho
        + "\nOutput coordinates:" + N + " North, " + E + " East");
        */
    return xy;
}


module.exports.convert = StatePlaneConverter;
