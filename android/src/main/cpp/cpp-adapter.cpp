#include <jni.h>
#include "nitroocrOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::nitroocr::initialize(vm);
}
