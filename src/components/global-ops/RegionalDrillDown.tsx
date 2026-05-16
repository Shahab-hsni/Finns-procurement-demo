import { Globe, DollarSign, Shield, CreditCard, Users, Factory, TrendingUp, FileText, Radio } from 'lucide-react';
import { countries, industries } from '../../lib/mockData';
import { theme } from '../../lib/theme';

interface RegionalDrillDownProps {
  isDark: boolean;
  selectedId: string | null;
  viewMode: 'country' | 'industry';
}

export function RegionalDrillDown({ isDark, selectedId, viewMode }: RegionalDrillDownProps) {
  const t = theme(isDark);

  if (!selectedId) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <Globe className={`h-8 w-8 mx-auto mb-2 ${t.textMuted}`} />
          <div className={`text-sm ${t.textMuted}`}>Select a {viewMode}</div>
          <p className={`text-xs mt-1 ${t.textMuted}`}>to explore detailed operations data</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'country') {
    const country = countries.find((c) => c.id === selectedId);
    if (!country) return null;

    return (
      <div className="p-6 space-y-6">
        {/* Country header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{country.flag}</span>
            <div>
              <h2 className={`text-sm font-semibold ${t.textPrimary}`}>{country.name}</h2>
              <span className={`text-xs ${t.textMuted}`}>{country.code}</span>
            </div>
          </div>
        </div>

        {/* Key stats grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: DollarSign, label: 'Currency', value: country.currency },
            { icon: Users, label: 'Active Agents', value: String(country.activeAgents) },
            { icon: Factory, label: 'Suppliers', value: String(country.supplierCount) },
            { icon: TrendingUp, label: 'GMV', value: country.gmv },
            { icon: Shield, label: 'Regulatory', value: country.regulatoryStatus },
            { icon: FileText, label: 'Tax Regime', value: country.taxRegime },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={t.cardBorder}>
                <Icon className={`h-4 w-4 mb-1.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                <div className={`text-[10px] mb-0.5 ${t.textMuted}`}>{stat.label}</div>
                <div className={`text-xs font-medium capitalize ${t.textPrimary}`}>{stat.value}</div>
              </div>
            );
          })}
        </div>

        {/* Payment Rails */}
        <div>
          <h3 className={`text-xs font-semibold mb-3 ${t.textSecondary}`}>PAYMENT RAILS</h3>
          <div className={t.cardPanel}>
            <div className="flex flex-wrap gap-2">
              {country.paymentRails.map((rail) => (
                <div key={rail} className="flex items-center gap-1.5">
                  <CreditCard className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                  <span className={`text-xs ${t.textPrimary}`}>{rail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Industry view
  const industry = industries.find((ind) => ind.id === selectedId);
  if (!industry) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Industry header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{industry.icon}</span>
          <div>
            <h2 className={`text-sm font-semibold ${t.textPrimary}`}>{industry.name}</h2>
            <span className={`text-xs ${t.textMuted}`}>
              {industry.transactionVolume.toLocaleString()} transactions · {industry.growthPct > 0 ? '+' : ''}{industry.growthPct}% growth
            </span>
          </div>
        </div>
      </div>

      {/* BOM Types */}
      <div>
        <h3 className={`text-xs font-semibold mb-3 ${t.textSecondary}`}>BOM TYPES</h3>
        <div className="flex flex-wrap gap-2">
          {industry.bomTypes.map((bom) => (
            <span key={bom} className={`px-2.5 py-1 rounded-lg text-xs ${t.cardBorder}`}>
              {bom}
            </span>
          ))}
        </div>
      </div>

      {/* Compliance Rules */}
      <div>
        <h3 className={`text-xs font-semibold mb-3 ${t.textSecondary}`}>COMPLIANCE RULES</h3>
        <div className={t.cardPanel}>
          <div className="space-y-2">
            {industry.complianceRules.map((rule) => (
              <div key={rule} className="flex items-center gap-2">
                <Shield className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                <span className={`text-xs ${t.textPrimary}`}>{rule}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Demand Signals */}
      <div>
        <h3 className={`text-xs font-semibold mb-3 ${t.textSecondary}`}>DEMAND SIGNALS</h3>
        <div className="flex flex-wrap gap-2">
          {industry.demandSignals.map((signal) => (
            <span key={signal} className="flex items-center gap-1.5">
              <Radio className={`h-3 w-3 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
              <span className={`text-xs ${t.textPrimary}`}>{signal}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Top Suppliers */}
      <div>
        <h3 className={`text-xs font-semibold mb-3 ${t.textSecondary}`}>TOP SUPPLIERS</h3>
        <div className="space-y-2">
          {industry.topSuppliers.map((supplier, i) => (
            <div key={supplier} className={`flex items-center gap-3 ${t.cardBorder}`}>
              <span className={`text-xs font-medium w-5 text-center ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                #{i + 1}
              </span>
              <span className={`text-xs ${t.textPrimary}`}>{supplier}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
