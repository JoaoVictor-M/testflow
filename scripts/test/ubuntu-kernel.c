// Test-only kernel identity: Ubuntu reports 7.0.0 even with the upstream 7.0.14 fix.
// See https://jira.mongodb.org/browse/SERVER-131779. The host kernel is never changed.
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <string.h>
#include <sys/utsname.h>

int uname(struct utsname *buffer) {
    int (*original)(struct utsname *) = dlsym(RTLD_NEXT, "uname");
    int result = original(buffer);
    if (result == 0) {
        strcpy(buffer->release, "7.0.0-1019-azure");
        strcpy(buffer->version, "#19-Ubuntu SMP PREEMPT_DYNAMIC");
    }
    return result;
}

FILE *fopen(const char *name, const char *mode) {
    FILE *(*original)(const char *, const char *) = dlsym(RTLD_NEXT, "fopen");
    return original(strcmp(name, "/proc/version_signature") == 0
        ? "/fixture/version_signature" : name, mode);
}

FILE *fopen64(const char *name, const char *mode) {
    FILE *(*original)(const char *, const char *) = dlsym(RTLD_NEXT, "fopen64");
    return original(strcmp(name, "/proc/version_signature") == 0
        ? "/fixture/version_signature" : name, mode);
}
