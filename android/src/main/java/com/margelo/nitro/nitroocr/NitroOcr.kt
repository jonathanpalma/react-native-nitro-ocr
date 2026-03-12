package com.margelo.nitro.nitroocr
  
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class NitroOcr : HybridNitroOcrSpec() {
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }
}
