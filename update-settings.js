const fs = require('fs');

const path = './src/app/settings/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Destructure setAgencyProfile
content = content.replace(
  `const { signature, resume, websites, setSignature, setResume, addWebsite, removeWebsite, clearData } = useAppStore();`,
  `const { signature, resume, agencyProfile, websites, setSignature, setResume, setAgencyProfile, addWebsite, removeWebsite, clearData } = useAppStore();`
);

// 2. Add local state for agencyForm
const stateToAdd = `
  const [agencyForm, setAgencyForm] = useState({
    companyName: "Sangeeta Infotech",
    websiteUrl: "",
    contactEmail: "",
    contactPhone: "",
    establishedYear: "2018",
    services: ["Web Development", "App Development"],
    signature: { fullName: "", email: "", phone: "", location: "", portfolioUrl: "" }
  });
`;

content = content.replace(
  `const [resumeFile, setResumeFile] = useState<File | null>(null);`,
  `const [resumeFile, setResumeFile] = useState<File | null>(null);\n${stateToAdd}`
);

// 3. Load agencyProfile on mount
const effectToUpdate = `
  useEffect(() => {
    setMounted(true);
    if (signature) {
      setFormData(signature);
    }
    if (agencyProfile) {
      setAgencyForm(agencyProfile as any);
    }
  }, [signature, agencyProfile]);
`;

content = content.replace(
  /useEffect\(\(\) => \{\s+setMounted\(true\);\s+if \(signature\) \{\s+setFormData\(signature\);\s+\}\s+\}, \[signature\]\);/g,
  effectToUpdate
);

// 4. Update handleSave
const handleSaveToUpdate = `
  const handleSave = async () => {
    setSignature(formData);
    setAgencyProfile(agencyForm as any);
    
    // Sync to backend for background worker
    try {
      const store = useAppStore.getState();
      await fetch("/api/auto-scout/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: formData,
          resume: store.resume,
          agencyProfile: store.agencyProfile,
          autoScoutPreferences: store.autoScoutPreferences,
          websites: store.websites
        })
      });
`;

content = content.replace(
  /const handleSave = async \(\) => \{[\s\S]*?JSON\.stringify\(\{[\s\S]*?websites: store\.websites\s+\}\)\s+\}\);/m,
  handleSaveToUpdate
);


// 5. Add UI Section 5
const agencyUI = `
        {/* Section 5: Agency Profile */}
        <section className="bg-white rounded-2xl shadow-sm border p-8">
          <h2 className="text-xl font-semibold mb-6 flex items-center">
            <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">5</span>
            IT Agency Profile (e.g. Sangeeta Infotech)
          </h2>
          <p className="text-sm text-gray-500 mb-6">Configure details for B2B leads. When the AI detects a company looking for an IT Agency, it will pitch this profile instead.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input type="text" className="w-full px-4 py-2 border rounded-lg" value={agencyForm.companyName} onChange={e => setAgencyForm({...agencyForm, companyName: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
              <input type="url" className="w-full px-4 py-2 border rounded-lg" value={agencyForm.websiteUrl} onChange={e => setAgencyForm({...agencyForm, websiteUrl: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agency Contact Email</label>
              <input type="email" className="w-full px-4 py-2 border rounded-lg" value={agencyForm.contactEmail} onChange={e => setAgencyForm({...agencyForm, contactEmail: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sales Rep Name (Signature)</label>
              <input type="text" className="w-full px-4 py-2 border rounded-lg" value={agencyForm.signature.fullName} onChange={e => setAgencyForm({...agencyForm, signature: {...agencyForm.signature, fullName: e.target.value}})} />
            </div>
          </div>
        </section>
`;

content = content.replace(
  `        <div className="flex justify-end pt-4">`,
  `${agencyUI}\n        <div className="flex justify-end pt-4">`
);

fs.writeFileSync(path, content, 'utf8');
