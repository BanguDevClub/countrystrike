import { useMemo } from 'react'
import katex from 'katex'
import {
  COMPOSITE_METRICS,
  DIFFICULTIES,
  GOVERNMENTS,
  MINISTRIES,
  RESOURCES,
  TRADE_PRICING,
  UNITS,
} from '../game/constants'
import { PageHeader, SectionCard, Badge } from '../components/ui'
import { Icon } from '../components/Icon'
import { formatMoney, formatNumber, formatQuantity } from '../game/format'

const PRICING_KEYS = ['below', 'market', 'above'] as const

function Formula({ tex, block = true }: { tex: string; block?: boolean }) {
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        throwOnError: false,
        displayMode: block,
        strict: false,
        trust: false,
      }),
    [tex, block],
  )
  return (
    <div
      className={`formula ${block ? 'formula-block' : 'formula-inline'}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function MethodSection({
  id,
  title,
  subtitle,
  children,
}: {
  id: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <SectionCard
      className="method-section"
      title={<span id={id}>{title}</span>}
      subtitle={subtitle}
      action={<Badge tone="muted">{id}</Badge>}
    >
      {children}
    </SectionCard>
  )
}

export function Methodology() {
  return (
    <div className="page methodology-page">
      <PageHeader page="methodology">
        <Badge tone="accent" icon="Sigma">
          Every number has a formula
        </Badge>
      </PageHeader>

      <SectionCard className="method-hero">
        <div className="method-hero-icon">
          <Icon name="Sigma" size={32} />
        </div>
        <div>
          <span className="mini-kicker">Open computation</span>
          <h2>The rules behind the world</h2>
          <p>
            Country Strike is transparent by construction. This page documents the production
            equations, market maker, fiscal model, approvals, composite score and victory conditions
            used by the simulation. Values are rounded for display but not for the simulation
            itself.
          </p>
          <div className="method-hero-tags">
            <span>
              <Icon name="Dices" size={14} /> Deterministic rolls
            </span>
            <span>
              <Icon name="Gauge" size={14} /> 0–100 composite score
            </span>
            <span>
              <Icon name="Globe" size={14} /> Procedural worlds
            </span>
            <span>
              <Icon name="Save" size={14} /> Local save state
            </span>
          </div>
        </div>
      </SectionCard>

      <div className="method-toc">
        {[
          ['#turn', 'Turn structure'],
          ['#world', 'World generation'],
          ['#resources', 'Resource flow'],
          ['#prices', 'Market prices'],
          ['#fiscal', 'Taxes & Laffer'],
          ['#budget', 'Budget'],
          ['#military', 'Military power'],
          ['#trade', 'Trade & relations'],
          ['#composite', 'Composite score'],
          ['#goals', 'Goals & difficulty'],
          ['#reference', 'Reference tables'],
        ].map(([href, label]) => (
          <a key={href} className="toc-link" href={href}>
            {label}
          </a>
        ))}
      </div>

      <MethodSection
        id="turn"
        title="Turn structure"
        subtitle="A turn is a fiscal cycle. The player acts, rival governments act, then the world settles."
      >
        <div className="method-grid">
          <div>
            <p>
              You receive <strong>10 actions</strong> at the start of every turn. Actions pay for
              industrial operations, military procurement, tax and ministry changes, debt
              operations, diplomatic missions and trade contracts. Ending the turn runs the economy
              and resets the action counter.
            </p>
            <p>
              Events do not consume actions. They are delivered after the settlement phase and must
              be resolved before the next turn can be ended.
            </p>
          </div>
          <div className="method-formula-col">
            <Formula tex={String.raw`A_{t+1} = A_{\max} = 10`} />
            <Formula
              tex={String.raw`\text{rate}_{AI} = \{0, 3, 5\}\ \text{actions per rival per turn}`}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Difficulty</th>
                <th>Rival actions / turn</th>
                <th>Hostility threshold</th>
                <th>Attack pressure</th>
              </tr>
            </thead>
            <tbody>
              {DIFFICULTIES.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <strong>{entry.name}</strong> — {entry.tagline}
                  </td>
                  <td className="num">{entry.aiActions}</td>
                  <td className="num">
                    {entry.hostileAt === null ? 'Never' : `${entry.hostileAt} relations`}
                  </td>
                  <td className="num">{Math.round(entry.aggression * 100)}% / turn</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MethodSection>

      <MethodSection
        id="world"
        title="World generation"
        subtitle="A seeded map, the country traits and the starting distribution of resources."
      >
        <div className="method-grid">
          <div>
            <p>
              Countries are assigned across 1–5 continents. Every country receives a culture, a
              biome, a weather pattern and two additional national traits. Each trait contributes a
              buff, a debuff or a mixed modifier to extraction, reserves, consumption, trade, taxes,
              military upkeep, research, approval, corruption, security or growth.
            </p>
            <p>
              The map is generated with a seeded Voronoi partition of each continent. Country GDP
              starts as population × GDP per capita; treasury starts at 3.5–11% of GDP and debt at
              25–82% of GDP.
            </p>
          </div>
          <div className="method-formula-col">
            <Formula tex={String.raw`\text{GDP}_0 = P_0 \times \text{GDP per capita}_0`} />
            <Formula
              tex={String.raw`\text{Reserves}_0 = L_e \times C_{\text{res}} \times R,\quad R \in [55,190] \text{ (commodity)}`}
            />
            <Formula
              tex={String.raw`\text{Extraction}_0 \approx \max(0.7C,\ \text{consumption} \times [0.72,1.38])`}
            />
          </div>
        </div>
        <div className="formula-note">
          The seed is stored with the save. Reloading a world never rerolls a die or redraws a map.
        </div>
        <div className="government-list">
          {GOVERNMENTS.map((government) => (
            <div key={government.id} className="government-list-row">
              <span className="government-list-icon">
                <Icon name={government.icon} size={18} />
              </span>
              <div>
                <strong>{government.name}</strong>
                <span>{government.description}</span>
              </div>
              <div className="government-list-effects">
                <Badge tone="positive">{government.buff}</Badge>
                <Badge tone="negative">{government.debuff}</Badge>
              </div>
            </div>
          ))}
        </div>
      </MethodSection>

      <MethodSection
        id="resources"
        title="Resource flow"
        subtitle="Extraction and refinement set capacity; population and the military set demand."
      >
        <div className="formula-stack">
          <Formula
            tex={String.raw`\text{Extraction} = L_e \cdot C \cdot (1 + m_{\text{extraction}} + m_{\text{resource}}) \cdot B_{\text{industry}} \cdot (1 + b_{\text{research}})`}
          />
          <Formula
            tex={String.raw`\text{Refinement} = L_r \cdot C \cdot \left(1 + 0.55\,m_{\text{extraction}}\right) \cdot B_{\text{industry}} \cdot (1 + b_{\text{research}})`}
          />
          <Formula
            tex={String.raw`\text{Production} = \min(\text{Extraction},\text{Refinement}) \cdot (1 + 0.15\,A)`}
          />
          <Formula
            tex={String.raw`\text{Consumption} = P \cdot c_{\text{civil}} \cdot (1 + m_{\text{consumption}}) + \sum_{\text{units}} N_u \cdot u_{\text{resource}}`}
          />
          <Formula
            tex={String.raw`\text{Final Balance} = \text{Production} + \text{Imports} - \text{Consumption} - \text{Exports}`}
          />
          <Formula
            tex={String.raw`\text{Stock}_{t+1} = \max(0,\ \text{Stock}_t + \text{Final Balance})`}
          />
          <Formula
            tex={String.raw`\text{Known Reserves}_{t+1} = \max(0,\ \text{Known Reserves}_t - \text{Production})`}
          />
        </div>
        <p>
          <strong>
            b<sub>research</sub>
          </strong>{' '}
          is the accumulated research bonus on extraction and refinement (+5%, +10%, or +20% per
          roll), <strong>A</strong> is the number of major advancements (15% output each, up to five
          per resource), and{' '}
          <strong>
            B<sub>industry</sub>
          </strong>{' '}
          is the Ministry of Industry budget multiplier (low 0.96, normal 1.00, high 1.04).
        </p>
        <p>
          <strong>Upgrades (d6):</strong> 1 is failure, 2 small improvement (+1 Lv / modest
          reserves), 3 average improvement (+2 Lv / solid reserves), 4–5 good improvement (+3 Lv /
          rich reserves), 6 improvement with an advancement (+3 Lv / rich reserves &amp; +1
          advancement).
        </p>
        <p>
          <strong>Research stimulus (single d10):</strong> 1 is failure, 2–4 is +5% bonus on
          extraction and refinement, 5–9 is +10% bonus, 10 is +20% bonus with an advancement.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                <th>Class</th>
                <th className="num">Base price</th>
                <th className="num">Capacity / level</th>
                <th className="num">Civil use / million people</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map((resource) => (
                <tr key={resource.id}>
                  <td>
                    <span
                      className="resource-inline"
                      style={{ color: `var(${resource.colorVar})` }}
                    >
                      <Icon name={resource.icon} size={14} /> {resource.name}
                    </span>
                  </td>
                  <td>
                    <Badge tone={resource.category === 'strategic' ? 'warning' : 'muted'}>
                      {resource.category}
                    </Badge>
                  </td>
                  <td className="num">{formatMoney(resource.basePrice)}</td>
                  <td className="num">{formatQuantity(resource.capacityPerLevel)}</td>
                  <td className="num">{formatQuantity(resource.civilPerMillion)}</td>
                  <td>{resource.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MethodSection>

      <MethodSection
        id="prices"
        title="Market prices"
        subtitle="A smoothed supply-and-demand reference price. Strategic scarcity is expressed in the base price."
      >
        <div className="method-grid">
          <div>
            <p>
              The world price is computed from every living country's production and consumption.
              Demand pressure is dampened by a 0.55 exponent, clamped, and blended with the previous
              price each turn. A small deterministic noise term prevents prices from freezing.
            </p>
            <p>
              Deal prices are set relative to the reference: below market = 80%, at market = 100%,
              above market = 125%. Contracts lock that unit price for their duration.
            </p>
          </div>
          <div className="method-formula-col">
            <Formula
              tex={String.raw`D = \sum_i \text{consumption}_i,\quad S = \sum_i \text{production}_i`}
            />
            <Formula
              tex={String.raw`P^* = P_{\text{base}} \cdot \operatorname{clamp}\left(\left(\frac{D}{S}\right)^{0.55}, 0.55, 2.6\right)`}
            />
            <Formula
              tex={String.raw`P_{t+1} = \operatorname{clamp}\left(\operatorname{lerp}(P_t, P^*, 0.28)\cdot[0.975,1.025], 0.35P_{\text{base}}, 3P_{\text{base}}\right)`}
            />
          </div>
        </div>
        <div className="market-term-grid">
          {PRICING_KEYS.map((key) => (
            <div key={key} className={`market-term pricing-${key}`}>
              <div className="market-term-head">
                <strong>{TRADE_PRICING[key].label}</strong>
                <Badge tone={TRADE_PRICING[key].relation > 0 ? 'positive' : 'muted'}>
                  +{TRADE_PRICING[key].relation} relations
                </Badge>
              </div>
              <span>{Math.round(TRADE_PRICING[key].multiplier * 100)}% of market</span>
              <p>{TRADE_PRICING[key].hint}</p>
            </div>
          ))}
        </div>
      </MethodSection>

      <MethodSection
        id="fiscal"
        title="Taxes & the Laffer curve"
        subtitle="Tax rates are not revenue rates. Collection efficiency peaks at a burden of 40 and declines on both sides."
      >
        <div className="method-grid">
          <div>
            <p>
              The tax burden combines all four policy rates. Corporate and income taxes each have a
              0.35 weight, tariffs 0.05 per percentage point, and resource royalties 0.25. Revenue
              uses the Laffer multiplier and a collection factor influenced by corruption, the
              Finance budget and government type.
            </p>
            <p>
              High corporate rates can trigger capital flight; very low rates can trigger a
              tax-haven boom. A burden above 58 tends to generate a Laffer warning event. All four
              taxes are policy levers; each applied change costs one action.
            </p>
          </div>
          <div className="method-formula-col">
            <Formula tex={String.raw`b = 0.35\,C + 0.35\,I + 0.05\,T + 0.25\,R`} />
            <Formula
              tex={String.raw`L(b) = \operatorname{clamp}\left(1-\left(\frac{b-40}{70}\right)^2,\ 0.2,\ 1\right)`}
            />
            <Formula
              tex={String.raw`\text{Corporate} = \text{GDP} \cdot 0.28 \cdot \frac{C}{100} \cdot L(b) \cdot E`}
            />
            <Formula
              tex={String.raw`\text{Income} = \text{GDP} \cdot 0.55 \cdot \frac{I}{100} \cdot L(b) \cdot E`}
            />
            <Formula
              tex={String.raw`\text{Tariff} = \min\left(\text{import value}\cdot\frac{T}{100},\ 0.18\,\text{GDP}\right)`}
            />
            <Formula
              tex={String.raw`\text{Royalty} = \text{production value}\cdot\frac{R}{100}\cdot 0.35`}
            />
          </div>
        </div>
        <p className="formula-note">
          E = 1 + tax-efficiency modifiers + 3% × Finance budget level − corruption/500, clamped to
          [0.55, 1.30]. The Finance budget level is −1, 0 or +1 for low, normal or high.
        </p>
      </MethodSection>

      <MethodSection
        id="budget"
        title="Budget accounting"
        subtitle="Revenue, public services, ministries, debt service, imports and military upkeep are settled every turn."
      >
        <div className="formula-stack">
          <Formula
            tex={String.raw`\text{Revenue} = \text{Corporate} + \text{Income} + \text{Tariff} + \text{Royalty} + \text{Export revenue}`}
          />
          <Formula
            tex={String.raw`\text{Expenses} = \sum_{m} \text{GDP}\cdot c_m + 0.08\,\text{GDP} + \text{Upkeep} + \text{Debt}\cdot\frac{r}{100} + \text{Import cost}`}
          />
          <Formula tex={String.raw`c_m = 0.004\ (low),\ 0.008\ (normal),\ 0.016\ (high)`} />
          <Formula tex={String.raw`\text{Net} = \text{Revenue} - \text{Expenses}`} />
          <Formula tex={String.raw`\text{Treasury}_{t+1} = \text{Treasury}_t + \text{Net}`} />
          <Formula
            tex={String.raw`\text{Debt}_{t+1} = \text{Debt}_t + \max(0, -\text{Treasury}_{t+1})`}
          />
        </div>
        <p>
          Public services cost 8% of GDP each turn. If the treasury would go negative, the
          difference is added to debt automatically. Debt interest is charged on the outstanding
          stock. The lender limit is{' '}
          <Formula
            tex={String.raw`\text{GDP}\cdot\left(0.55+\frac{r}{25}\right)\cdot\operatorname{clamp}\left(0.6+\frac{\text{approval}}{150},0.55,1.25\right)`}
            block={false}
          />
          .
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ministry</th>
                <th>Focus</th>
                <th>Low / normal / high cost (% GDP)</th>
              </tr>
            </thead>
            <tbody>
              {MINISTRIES.map((ministry) => (
                <tr key={ministry.id}>
                  <td>
                    <span className="resource-inline">
                      <Icon name={ministry.icon} size={14} /> {ministry.name}
                    </span>
                  </td>
                  <td>{ministry.focus}</td>
                  <td className="num">
                    {(ministry.budgetCost.low * 100).toFixed(2)}% /{' '}
                    {(ministry.budgetCost.normal * 100).toFixed(2)}% /{' '}
                    {(ministry.budgetCost.high * 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MethodSection>

      <MethodSection
        id="military"
        title="Military power"
        subtitle="A composite of platforms and warheads. Nukes and jets carry the largest weights per unit."
      >
        <div className="method-grid">
          <div>
            <p>
              Military power is the weighted sum of every platform. It is used for war resolution,
              ranking and the enemy's estimate of your deterrence. War is resolved on a d100 against
              a victory probability derived from both sides' power.
            </p>
            <Formula
              tex={String.raw`\text{Win chance} = \operatorname{clamp}\left(15 + 70\cdot\frac{\text{own power}}{\text{own power}+\text{enemy power}},\ 10,\ 92\right)`}
            />
            <p>
              Units also use strategic resources for procurement and every turn for upkeep. Soldiers
              improve security and reduce corruption through presence, but only up to a point.
            </p>
          </div>
          <div className="method-formula-col">
            <Formula tex={String.raw`\text{Power} = \sum_u N_u \cdot w_u`} />
            <Formula
              tex={String.raw`\text{Upkeep} = \sum_u N_u \cdot k_u \cdot (1+m_{\text{military}}) \cdot (1-0.04B_{\text{defense}})`}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th className="num">Power / unit</th>
                <th className="num">Recruit cost</th>
                <th className="num">Upkeep / turn</th>
                <th>Strategic materials</th>
              </tr>
            </thead>
            <tbody>
              {UNITS.map((unit) => (
                <tr key={unit.id}>
                  <td>
                    <span className="resource-inline">
                      <Icon name={unit.icon} size={14} /> {unit.name}
                    </span>
                  </td>
                  <td className="num">{formatNumber(unit.power, 3)}</td>
                  <td className="num">{formatMoney(unit.recruitCost)}</td>
                  <td className="num">{formatMoney(unit.upkeep)}</td>
                  <td>
                    {Object.keys(unit.resourceCost).length === 0
                      ? '—'
                      : Object.entries(unit.resourceCost)
                          .map(([id, amount]) => `${id} ${formatQuantity(amount ?? 0)}`)
                          .join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MethodSection>

      <MethodSection
        id="trade"
        title="Trade & relations"
        subtitle="Contracts, price posture and the diplomatic consequences."
      >
        <div className="method-grid">
          <div>
            <p>
              A deal is a 5-turn contract with a fixed unit price and quantity. Each turn, imports
              are paid for and exports collected. Contracts affect both sides' resource balances.
              Signing costs one action; cancelling is free.
            </p>
            <p>
              Relations with a country determine the external-approval unlock. Tariffs reduce
              relations each turn. At 100 relations, external approval campaigns become available.
              At 100 approval, the country can be merged for two actions.
            </p>
            <p>
              Auto-deals run automatically each turn without action cost. When enabled for a
              resource, the government exports the minimal amount (1 unit) to all rival countries in
              need under 3-turn contracts. Each turn an auto-deal runs, it steadily enhances
              diplomatic relations (+2/turn for below market, +1/turn for at or above market).
            </p>
          </div>
          <div className="method-formula-col">
            <Formula
              tex={String.raw`\text{Deal price} = P_{\text{market}} \cdot \{0.8,\ 1.0,\ 1.25\}`}
            />
            <Formula tex={String.raw`\text{Relations gain} = \{+10,\ +3,\ 0\}`} />
            <Formula
              tex={String.raw`\text{Relation drift}_t = \text{noise} - \frac{\text{tariff}}{90} + 0.25B_{\text{foreign}}`}
            />
            <Formula
              tex={String.raw`\text{Approval campaign} \rightarrow +5\text{ to }+13\ \text{external approval}`}
            />
            <Formula
              tex={String.raw`\text{Auto-deal} = 1\ \text{unit},\ 3\ \text{turns},\ +1\text{ to }+2\ \text{relations/turn to all in need}`}
            />
          </div>
        </div>
        <div className="notice notice-neutral">
          <Icon name="Info" size={17} />
          <div>
            <strong>Victory routes.</strong>
            <span>
              Merge every rival: reach 100 relations, unlock external approval, fund it to 100, then
              merge. Or destroy every rival in war. The game ends when no non-player country remains
              alive.
            </span>
          </div>
        </div>
      </MethodSection>

      <MethodSection
        id="composite"
        title="Composite score"
        subtitle="A normalized, weighted score from 0 to 100. Treasure has the highest priority."
      >
        <div className="method-grid">
          <div>
            <p>
              For each metric, countries are min–max normalized across all living states. Metrics
              where lower is better are inverted. Each normalized value is multiplied by its fixed
              weight; the weighted total is the composite. If all countries share the same metric
              value, normalization returns 0.5.
            </p>
            <Formula
              tex={String.raw`\tilde{x}_{i,k} = \frac{x_{i,k}-\min_k}{\max_k-\min_k}\quad\text{(or }1-\tilde{x}\text{ for low-is-good)}`}
            />
            <Formula
              tex={String.raw`S_i = \sum_k w_k \cdot \tilde{x}_{i,k},\quad S_i \in [0,100]`}
            />
            <p>
              Treasury, GDP and population are log-scaled before normalization. Debt, Gini, violence
              and depression are inverted. This prevents giant economies from flattening every other
              dimension.
            </p>
          </div>
          <div className="method-formula-col">
            <Formula tex={String.raw`\text{treasury}' = \log_{10}(\max(\text{treasury},0)+1)`} />
            <Formula
              tex={String.raw`\text{debt}' = 1-\operatorname{normalize}(\log_{10}(\text{debt}+1))`}
            />
            <Formula
              tex={String.raw`\text{GDP}' = \operatorname{normalize}(\log_{10}\text{GDP})`}
            />
            <Formula
              tex={String.raw`\text{Population}' = \operatorname{normalize}(\log_{10}\text{population})`}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Pillar</th>
                <th className="num">Weight</th>
                <th>Direction</th>
                <th>Normalization</th>
              </tr>
            </thead>
            <tbody>
              {COMPOSITE_METRICS.map((metric, index) => (
                <tr key={metric.key}>
                  <td className="num">{index + 1}</td>
                  <td>
                    <strong>{metric.label}</strong>
                  </td>
                  <td className="num">{metric.weight}%</td>
                  <td>{metric.direction === 'high' ? 'Higher is better' : 'Lower is better'}</td>
                  <td className="mono">{metric.formula}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MethodSection>

      <MethodSection
        id="goals"
        title="Goals & difficulty"
        subtitle="The end state, hostility thresholds and the AI rhythm."
      >
        <div className="goal-method-grid">
          <div className="goal-method-card">
            <span className="goal-method-index">01</span>
            <strong>Reach 100 relations</strong>
            <p>Trade at or below market, run diplomatic missions, and keep tariffs low.</p>
          </div>
          <div className="goal-method-card">
            <span className="goal-method-index">02</span>
            <strong>Unlock external approval</strong>
            <p>At full alignment, fund campaigns to push approval to 100.</p>
          </div>
          <div className="goal-method-card">
            <span className="goal-method-index">03</span>
            <strong>Merge or destroy</strong>
            <p>Merge for 2 actions; war for 1 action and a d100 battle check.</p>
          </div>
          <div className="goal-method-card">
            <span className="goal-method-index">04</span>
            <strong>End with one state</strong>
            <p>The game is won when every non-player country is merged or destroyed.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Difficulty</th>
                <th>AI actions</th>
                <th>Hostile at</th>
                <th>Attack chance / hostile nation / turn</th>
                <th>Design intent</th>
              </tr>
            </thead>
            <tbody>
              {DIFFICULTIES.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <strong>{entry.name}</strong>
                  </td>
                  <td className="num">{entry.aiActions}</td>
                  <td className="num">{entry.hostileAt === null ? 'Never' : entry.hostileAt}</td>
                  <td className="num">{Math.round(entry.aggression * 100)}%</td>
                  <td>{entry.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MethodSection>

      <MethodSection
        id="reference"
        title="Reference tables"
        subtitle="All static values used by the simulation, in one place."
      >
        <div className="reference-grid">
          <div>
            <h3>Resource categories</h3>
            <p className="text-muted">
              Commodities are cheaper to prospect, extract and refine. Strategic resources are
              scarcer and more expensive at every level.
            </p>
            <div className="category-comparison">
              <div>
                <span className="category-dot commodity" /> Commodity cost factor{' '}
                <strong>1.0×</strong>
              </div>
              <div>
                <span className="category-dot strategic" /> Strategic cost factor{' '}
                <strong>2.25×</strong>
              </div>
              <div>
                <span className="category-dot military" /> Military procurement uses stock, not cash
                alone
              </div>
            </div>
          </div>
          <div>
            <h3>Industry operation costs</h3>
            <p className="text-muted">
              Cost = GDP × action factor × level factor × category factor, with a minimum.
            </p>
            <div className="reference-rows">
              <div>
                <span>Prospect fields</span>
                <strong>0.06% GDP × level</strong>
              </div>
              <div>
                <span>Upgrade extraction</span>
                <strong>0.16% GDP × level</strong>
              </div>
              <div>
                <span>Upgrade refinement</span>
                <strong>0.26% GDP × level</strong>
              </div>
              <div>
                <span>Research stimulus</span>
                <strong>0.40% GDP × level</strong>
              </div>
            </div>
          </div>
          <div>
            <h3>Approval & event triggers</h3>
            <div className="reference-rows">
              <div>
                <span>Tax revolt condition</span>
                <strong>burden &gt; 48</strong>
              </div>
              <div>
                <span>Capital flight</span>
                <strong>corporate rate &gt; 45%</strong>
              </div>
              <div>
                <span>Laffer warning</span>
                <strong>burden &gt; 58</strong>
              </div>
              <div>
                <span>Ministry scandal</span>
                <strong>highest corruption &gt; 55</strong>
              </div>
              <div>
                <span>Loyalty problem</span>
                <strong>lowest loyalty &lt; 32</strong>
              </div>
              <div>
                <span>Debt panic</span>
                <strong>debt &gt; 92% of lender limit</strong>
              </div>
            </div>
          </div>
          <div>
            <h3>Relation thresholds</h3>
            <div className="reference-rows">
              <div>
                <span>Allied / approval unlocked</span>
                <strong>100</strong>
              </div>
              <div>
                <span>Friendly</span>
                <strong>≥ 60</strong>
              </div>
              <div>
                <span>Cordial</span>
                <strong>≥ 20</strong>
              </div>
              <div>
                <span>Neutral</span>
                <strong>−19 to 19</strong>
              </div>
              <div>
                <span>Strained</span>
                <strong>−49 to −20</strong>
              </div>
              <div>
                <span>Hostile</span>
                <strong>≤ −50 (hard)</strong>
              </div>
              <div>
                <span>Hostile</span>
                <strong>≤ −100 (normal)</strong>
              </div>
            </div>
          </div>
        </div>
      </MethodSection>
    </div>
  )
}
