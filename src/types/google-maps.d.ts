// Google Maps Types
declare global {
    interface Window {
        google: typeof google;
        googleMapsLoaded?: boolean;
        initGoogleMaps?: () => void;
    }
}

export { };
