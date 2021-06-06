# Chaleira FCUP Documentation

This is the repository for the FCUP Chaleira project. 

Each of the folders contains a separate part of the work which should be installed on the proper device of the project. 

For more instructions check the corresponding folders.

## Firebase Rules

![Firebase](firebase-status-page/firebase.png)

The project assumes that a firebase realtime database exists, and it is configured with the following rules:

```javascript
{
    "rules": {
        ".read": true,
            ".write": true,
            "users": {
                "$uid": {
                    ".write": "auth != null && auth.uid == $uid",
                }
            },
        "kettle": {
            ".write": "auth != null && auth.uid == '<UUID>'"
        },
        "reservations": {
            ".write": "auth != null"
        },
        "user-reservations": {
            ".write": "auth != null && auth.uid == '<UUID>'",
            "$uid": {
                ".write": "auth != null && auth.uid == $uid || auth.uid == '<UUID>'"
            }
        }
    }
}
```

___IMPORTANT___: `<UUID>` is the UUID of our admin user, in your case you should create your own user and replace the UUID there.
