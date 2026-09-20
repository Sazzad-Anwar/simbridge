import { MotionConfig } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FAQ } from "@/components/FAQ";
import { HeroSection } from "@/sections/HeroSection";
import { TrustBar } from "@/sections/TrustBar";
import { ProblemSection } from "@/sections/ProblemSection";
import { HowItWorks } from "@/components/HowItWorks";
import { RealTimeSection } from "@/sections/RealTimeSection";
import { BackgroundRelaySection } from "@/sections/BackgroundRelaySection";
import { OfflineSyncSection } from "@/sections/OfflineSyncSection";
import { MultiSimSection } from "@/sections/MultiSimSection";
import { SecuritySection } from "@/sections/SecuritySection";
import { DataFlowSection } from "@/sections/DataFlowSection";
import { FeaturesSection } from "@/sections/FeaturesSection";
import { SenderReceiverSection } from "@/sections/SenderReceiverSection";
import { PairingSection } from "@/sections/PairingSection";
import { UseCasesSection } from "@/sections/UseCasesSection";
import { AppPreviewSection } from "@/sections/AppPreviewSection";
import { DownloadSection } from "@/sections/DownloadSection";
import { InstallSection } from "@/sections/InstallSection";
import { FinalCTA } from "@/sections/FinalCTA";

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <Navbar />
      <main id="main">
        <HeroSection />
        <TrustBar />
        <ProblemSection />
        <HowItWorks />
        <RealTimeSection />
        <BackgroundRelaySection />
        <OfflineSyncSection />
        <MultiSimSection />
        <SecuritySection />
        <DataFlowSection />
        <FeaturesSection />
        <SenderReceiverSection />
        <PairingSection />
        <UseCasesSection />
        <AppPreviewSection />
        <DownloadSection />
        <InstallSection />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </MotionConfig>
  );
}