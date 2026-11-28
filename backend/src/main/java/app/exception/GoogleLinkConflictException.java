package app.exception;

// Linking Google to the signed-in account was refused; the code says why (see GoogleLinkController).
public class GoogleLinkConflictException extends RuntimeException {

    private final String code;

    public GoogleLinkConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
