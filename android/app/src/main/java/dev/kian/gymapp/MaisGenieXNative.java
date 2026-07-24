package dev.kian.gymapp;

final class MaisGenieXNative {
    private static final boolean LOADED;
    private static final String LOAD_ERROR;

    static {
        boolean loaded = false;
        String error = null;
        try {
            System.loadLibrary("mais_geniex");
            loaded = true;
        } catch (Throwable reason) {
            error = reason.getMessage() == null ? reason.getClass().getSimpleName() : reason.getMessage();
        }
        LOADED = loaded;
        LOAD_ERROR = error;
    }

    private MaisGenieXNative() {}

    static boolean isLoaded() {
        return LOADED;
    }

    static String loadError() {
        return LOAD_ERROR;
    }

    static void requireLoaded() {
        if (!LOADED) {
            throw new IllegalStateException(
                "The My Mettle GenieX JNI bridge is unavailable" +
                (LOAD_ERROR == null ? "." : ": " + LOAD_ERROR)
            );
        }
    }

    static native long nativeCreate(String arm64Directory, String dspDirectory, String configJson);
    static native String nativeQuery(long handle, String prompt);
    static native void nativeReset(long handle);
    static native long nativeGetLastFirstChunkMs(long handle);
    static native long nativeGetLastQueryMs(long handle);
    static native int nativeGetLastSentenceCode(long handle);
    static native String nativeGetLastProfileJson(long handle);
    static native void nativeFree(long handle);
}
