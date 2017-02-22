package com.cedarsoftware.util

import com.cedarsoftware.ncube.ApplicationID
import com.cedarsoftware.ncube.Axis
import com.cedarsoftware.ncube.AxisType
import com.cedarsoftware.ncube.AxisValueType
import com.cedarsoftware.ncube.GroovyExpression
import com.cedarsoftware.ncube.NCube
import com.cedarsoftware.ncube.NCubeManager
import com.cedarsoftware.ncube.NCubeResourcePersister
import com.cedarsoftware.ncube.ReleaseStatus
import groovy.transform.CompileStatic
import org.junit.Before
import org.junit.Test

import static com.cedarsoftware.util.RpmVisualizerConstants.*
import static com.cedarsoftware.util.VisualizerTestConstants.*

@CompileStatic
class RpmVisualizerTest
{
    static final String PATH_PREFIX = 'rpmvisualizer/**/'
    static final String DETAILS_LABEL_UTILIZED_SCOPE = 'Utilized scope'
    static final String DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS = 'Utilized scope to load class without all traits'
    static final String DETAILS_LABEL_FIELDS = 'Fields'
    static final String DETAILS_LABEL_FIELDS_AND_TRAITS = 'Fields and traits'
    static final String DETAILS_LABEL_CLASS_TRAITS = 'Class traits'
    static final String VALID_VALUES_FOR_FIELD_SENTENCE_CASE = 'Valid values for field '
    static final String VALID_VALUES_FOR_FIELD_LOWER_CASE = 'valid values for field '

    RpmVisualizer visualizer
    ApplicationID appId = new ApplicationID(ApplicationID.DEFAULT_TENANT, 'test.visualizer', ApplicationID.DEFAULT_VERSION, ReleaseStatus.SNAPSHOT.name(), ApplicationID.HEAD)

    @Before
    void beforeTest(){
        visualizer = new RpmVisualizer()
        NCubeManager.NCubePersister = new NCubeResourcePersister(PATH_PREFIX)
    }

    @Test
    void testBuildGraph_checkVisInfo()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     product          : 'WProduct',
                     policyControlDate: '2017-01-01',
                     quoteDate        : '2017-01-01',
                     coverage         : 'FCoverage',
                     risk             : 'WProductOps']
        String startCubeName = 'rpm.class.Coverage'
        Map options = [startCubeName: startCubeName, scope: new CaseInsensitiveMap(scope)]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        RpmVisualizerInfo visInfo = graphInfo.visInfo as RpmVisualizerInfo

        //Check visInfo
        assert 5 == visInfo.nodes.size()
        assert 4 == visInfo.edges.size()
        assert 4l == visInfo.maxLevel
        assert 6l == visInfo.nodeCount
        assert 5l == visInfo.relInfoCount
        assert 3l == visInfo.defaultLevel
        assert '_ENUM' == visInfo.groupSuffix
        assert scope == visInfo.scope

        Map allGroups =  [PRODUCT: 'Product', FORM: 'Form', RISK: 'Risk', COVERAGE: 'Coverage', CONTAINER: 'Container', DEDUCTIBLE: 'Deductible', LIMIT: 'Limit', RATE: 'Rate', RATEFACTOR: 'Rate Factor', PREMIUM: 'Premium', PARTY: 'Party', PLACE: 'Place', ROLE: 'Role', ROLEPLAYER: 'Role Player', UNSPECIFIED: 'Unspecified']
        assert allGroups == visInfo.allGroups
        assert allGroups.keySet() == visInfo.allGroupsKeys
        assert ['COVERAGE', 'RISK'] as Set == visInfo.availableGroupsAllLevels

        //Spot check optionalScopeValues and requiredScopeValues
        //TODO: add asserts here for optionalScopeValues and requiredScopeValues

        assert ['rpm.class.Coverage': [] as Set,
                'rpm.enum.Coverage.Coverages': [] as Set,
                'rpm.class.Risk': [] as Set] == visInfo.requiredScopeKeys

        //Spot check optionalScopeKeys
        assert visInfo.requiredScopeKeys.keySet() == visInfo.optionalScopeKeys.keySet()
        assert visInfo.optionalScopeKeys['rpm.class.Risk'].containsAll(['LocationState', 'businessDivisionCode','transaction'])

        //Spot check typesToAddMap
        assert ['Coverage', 'Deductible', 'Limit', 'Premium', 'Rate', 'Ratefactor', 'Role'] == visInfo.typesToAddMap['Coverage']

        //Spot check the network overrides
        assert (visInfo.networkOverridesBasic.groups as Map).keySet().containsAll(allGroups.keySet())
        assert false == ((visInfo.networkOverridesFull.nodes as Map).shadow as Map).enabled
        assert (visInfo.networkOverridesTopNode.shapeProperties as Map).containsKey('borderDashes')
    }

    @Test
    void testBuildGraph_withVisualizerInfoAsArgument()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     product          : 'WProduct',
                     policyControlDate: '2017-01-01',
                     quoteDate        : '2017-01-01',
                     coverage         : 'FCoverage',
                     risk             : 'WProductOps']

        //Execute buildGraph with no visInfo as argument first
        String startCubeName = 'rpm.class.Coverage'
        Map options = [startCubeName: startCubeName, scope: new CaseInsensitiveMap(scope)]
        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        RpmVisualizerInfo firstVisInfo = graphInfo.visInfo as RpmVisualizerInfo

        //Execute buildGraph a second time with visInfo as an argument
        Map dummyAvailableScopeValues = [dummyKey: ['d1', 'd2'] as Set]
        firstVisInfo.optionalScopeValues = new HashMap(dummyAvailableScopeValues)
        firstVisInfo.nodes = []
        firstVisInfo.edges = []
        options = [startCubeName: startCubeName, visInfo: firstVisInfo, scope: new CaseInsensitiveMap(scope)]
        visualizer = new RpmVisualizer()
        graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        RpmVisualizerInfo secondVisInfo = graphInfo.visInfo as RpmVisualizerInfo

        //Check visInfo
        assert 5 == secondVisInfo.nodes.size()
        assert 4 == secondVisInfo.edges.size()
        assert 4l == secondVisInfo.maxLevel
        assert 6l == secondVisInfo.nodeCount
        assert 5l == secondVisInfo.relInfoCount
        assert 3l == secondVisInfo.defaultLevel
        assert '_ENUM' == secondVisInfo.groupSuffix
        assert scope == secondVisInfo.scope
        assert '[d1, d2]' == secondVisInfo.optionalScopeValues.dummyKey.toString()
    }


    @Test
    void testBuildGraph_canLoadTargetAsRpmClass()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     product:'WProduct',
                     policyControlDate:'2017-01-01',
                     quoteDate:'2017-01-01',
                     coverage: 'CCCoverage',
                     sourceCoverage: 'FCoverage',
                     risk: 'WProductOps']
        String startCubeName = 'rpm.class.Coverage'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert  STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List

        Map node = nodes.find {Map node -> "${UNABLE_TO_LOAD}Location".toString() == node.label}
        assert false == node.showCellValuesLink
        assert false == node.showCellValues
        assert false == node.cellValuesLoaded
        String nodeDetails = node.details as String
        assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert nodeDetails.contains(DETAILS_LABEL_REASON)
        assert nodeDetails.contains("Coverage points directly to Risk via field Location, but there is no risk named Location on Risk.")
        assert nodeDetails.contains("Therefore it cannot be loaded in the visualization.")
        assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
        assert !nodeDetails.contains(DETAILS_LABEL_FIELDS)
        assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
    }

    @Test
    void testBuildGraph_checkNodeAndEdge_nonEPM()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION]
        String startCubeName = 'rpm.class.partyrole.LossPrevention'
        Map options = [startCubeName: startCubeName, scope: new CaseInsensitiveMap(scope)]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        List<Map<String, Object>> edges = (graphInfo.visInfo as RpmVisualizerInfo).edges as List

        //Top level source node
        Map node = nodes.find { Map node1 -> startCubeName == node1.cubeName}
        assert null == node.fromFieldName
        assert 'partyrole.LossPrevention' == node.title
        assert 'partyrole.LossPrevention' == node.detailsTitle1
        assert null == node.detailsTitle2
        assert 'UNSPECIFIED' == node.group
        assert '1' == node.level
        assert 'partyrole.LossPrevention' == node.label
        assert null == node.sourceCubeName
        assert null == node.sourceDescription
        assert null == node.typesToAdd
        assert true == node.showCellValuesLink
        assert false == node.showCellValues
        assert true == node.cellValuesLoaded
        assert scope == node.scope
        assert scope == node.availableScope
        String nodeDetails = node.details as String
        assert nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
        assert nodeDetails.contains("${DETAILS_LABEL_FIELDS}</b><pre><ul><li>roleRefCode</li><li>Parties</li></ul></pre>")
        assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
        assert !nodeDetails.contains(DETAILS_LABEL_REASON)
        assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert !nodeDetails.contains(DETAILS_LABEL_CLASS_TRAITS)

        //Edge from top level node to enum
        Map edge = edges.find { Map edge -> 'partyrole.LossPrevention' == edge.fromName && 'partyrole.BasePartyRole.Parties' == edge.toName}
        assert 'Parties' == edge.fromFieldName
        assert '2' == edge.level
        assert 'Parties' == edge.label
        assert "Field Parties cardinality ${V_MIN_CARDINALITY}:${V_MAX_CARDINALITY}".toString() == edge.title

        //Enum node under top level node
        node = nodes.find { Map nodeEnum ->'rpm.enum.partyrole.BasePartyRole.Parties' == nodeEnum.cubeName}
        assert 'Parties' == node.fromFieldName
        assert "${VALID_VALUES_FOR_FIELD_SENTENCE_CASE}Parties on partyrole.LossPrevention".toString() == node.title
        assert "${VALID_VALUES_FOR_FIELD_SENTENCE_CASE}Parties on partyrole.LossPrevention".toString() == node.detailsTitle1
        assert null == node.detailsTitle2
        assert 'PARTY_ENUM' == node.group
        assert '2' == node.level
        assert null == node.label
        assert 'rpm.class.partyrole.LossPrevention' == node.sourceCubeName
        assert [_effectiveVersion: ApplicationID.DEFAULT_VERSION, sourceFieldName: 'Parties'] == node.scope
        assert [_effectiveVersion: ApplicationID.DEFAULT_VERSION, sourceFieldName: 'Parties'] == node.availableScope
        assert 'LossPrevention' == node.sourceDescription
        assert null == node.typesToAdd
        assert true == node.showCellValuesLink
        assert false == node.showCellValues
        assert true == node.cellValuesLoaded
        nodeDetails = node.details as String
        assert nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
        assert nodeDetails.contains("${DETAILS_LABEL_FIELDS}</b><pre><ul><li>party.MoreNamedInsured</li><li>party.ProfitCenter</li></ul></pre>")
        assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
        assert !nodeDetails.contains(DETAILS_LABEL_REASON)
        assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert !nodeDetails.contains(DETAILS_LABEL_CLASS_TRAITS)

        //Edge from enum to target node
        edge = edges.find { Map edge1 -> 'partyrole.BasePartyRole.Parties' == edge1.fromName && 'party.ProfitCenter' == edge1.toName}
        assert 'party.ProfitCenter' == edge.fromFieldName
        assert '3' == edge.level
        assert !edge.label
        assert 'Valid value party.ProfitCenter cardinality 0:1' == edge.title

        //Target node under enum
        node = nodes.find { Map node2 ->'rpm.class.party.ProfitCenter' == node2.cubeName}
        assert 'party.ProfitCenter' == node.fromFieldName
        assert 'party.ProfitCenter' == node.title
        assert 'party.ProfitCenter' == node.detailsTitle1
        assert null == node.detailsTitle2
        assert 'PARTY' == node.group
        assert '3' == node.level
        assert 'party.ProfitCenter' == node.label
        assert 'rpm.enum.partyrole.BasePartyRole.Parties' == node.sourceCubeName
        assert 'partyrole.BasePartyRole.Parties' == node.sourceDescription
        assert  [] == node.typesToAdd
        assert true == node.showCellValuesLink
        assert false == node.showCellValues
        assert true == node.cellValuesLoaded
        assert scope == node.scope
        assert [_effectiveVersion: ApplicationID.DEFAULT_VERSION, sourceFieldName: 'Parties'] == node.availableScope
        nodeDetails = node.details as String
        assert nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
        assert nodeDetails.contains("${DETAILS_LABEL_FIELDS}</b><pre><ul><li>roleRefCode</li><li>fullName</li><li>fein</li></ul></pre>")
        assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
        assert !nodeDetails.contains(DETAILS_LABEL_REASON)
        assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert !nodeDetails.contains(DETAILS_LABEL_CLASS_TRAITS)
    }

    @Test
    void testBuildGraph_checkStructure()
    {
        Map startScope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                          product          : 'WProduct',
                          policyControlDate: '2017-01-01',
                          quoteDate        : '2017-01-01',
                          coverage         : 'FCoverage',
                          risk             : 'WProductOps']


        String startCubeName = 'rpm.class.Coverage'
        Map options = [startCubeName: startCubeName, scope: startScope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        List<Map<String, Object>> edges = (graphInfo.visInfo as RpmVisualizerInfo).edges as List

        assert nodes.size() == 5
        assert edges.size() == 4

        assert nodes.find { Map node -> 'FCoverage' == node.label}
        assert nodes.find { Map node -> 'ICoverage' == node.label}
        assert nodes.find { Map node -> 'CCCoverage' == node.label}
        assert nodes.find { Map node -> "${UNABLE_TO_LOAD}Location".toString() == node.label}
        assert nodes.find { Map node -> "${VALID_VALUES_FOR_FIELD_SENTENCE_CASE}Coverages on FCoverage".toString() == node.title}

        assert edges.find { Map edge -> 'FCoverage' == edge.fromName && 'Coverage.Coverages' == edge.toName}
        assert edges.find { Map edge -> 'Coverage.Coverages' == edge.fromName && 'ICoverage' == edge.toName}
        assert edges.find { Map edge -> 'Coverage.Coverages' == edge.fromName && 'CCCoverage' == edge.toName}
        assert edges.find { Map edge -> 'CCCoverage' == edge.fromName && 'Location' == edge.toName}
    }

    @Test
    void testBuildGraph_checkStructure_nonEPM()
    {
        Map scope = null

        String startCubeName = 'rpm.class.partyrole.LossPrevention'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        List<Map<String, Object>> edges = (graphInfo.visInfo as RpmVisualizerInfo).edges as List

        assert nodes.size() == 4
        assert edges.size() == 3

        assert nodes.find { Map node ->'rpm.class.partyrole.LossPrevention' == node.cubeName}
        assert nodes.find { Map node ->'rpm.class.party.MoreNamedInsured' == node.cubeName}
        assert nodes.find { Map node ->'rpm.class.party.ProfitCenter' == node.cubeName}
        assert nodes.find { Map node ->'rpm.enum.partyrole.BasePartyRole.Parties' == node.cubeName}

        assert edges.find { Map edge ->'partyrole.BasePartyRole.Parties' == edge.fromName && 'party.ProfitCenter' == edge.toName}
        assert edges.find { Map edge ->'partyrole.BasePartyRole.Parties' == edge.fromName && 'party.MoreNamedInsured' == edge.toName}
        assert edges.find { Map edge ->'partyrole.LossPrevention' == edge.fromName && 'partyrole.BasePartyRole.Parties' == edge.toName}
    }

    @Test
    void testBuildGraph_checkNodeAndEdge()
    {
        Map startScope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     product          : 'WProduct',
                     policyControlDate: '2017-01-01',
                     quoteDate        : '2017-01-01',
                     coverage         : 'FCoverage',
                     risk             : 'WProductOps']

        Map enumScope = new CaseInsensitiveMap(startScope)
        enumScope.sourceFieldName = 'Coverages'

        Map cCoverageScope = new CaseInsensitiveMap(startScope)
        cCoverageScope.coverage = 'CCCoverage'
        cCoverageScope.sourceCoverage = 'FCoverage'

        Map availableCCCoverageScope = new CaseInsensitiveMap(cCoverageScope)
        availableCCCoverageScope.sourceFieldName = 'Coverages'

        String startCubeName = 'rpm.class.Coverage'
        Map options = [startCubeName: startCubeName, scope: new CaseInsensitiveMap(startScope)]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        List<Map<String, Object>> edges = (graphInfo.visInfo as RpmVisualizerInfo).edges as List

        //Top level source node
        Map node = nodes.find { Map node1 -> 'FCoverage' == node1.label}
        assert 'rpm.class.Coverage' == node.cubeName
        assert null == node.fromFieldName
        assert 'Coverage' == node.title
        assert 'Coverage' == node.detailsTitle1
        assert 'FCoverage' == node.detailsTitle2
        assert 'COVERAGE' == node.group
        assert '1' == node.level
        assert 'FCoverage' == node.label
        assert null == node.sourceCubeName
        assert null == node.sourceDescription
        assert ['Coverage', 'Deductible', 'Limit', 'Premium', 'Rate', 'Ratefactor', 'Role'] == node.typesToAdd
        assert true == node.showCellValuesLink
        assert false == node.showCellValues
        assert true == node.cellValuesLoaded
        assert startScope == node.scope
        assert startScope == node.availableScope
        String nodeDetails = node.details as String
        assert nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
        assert nodeDetails.contains("${DETAILS_LABEL_FIELDS}</b><pre><ul><li>Coverages</li><li>Exposure</li><li>StatCode</li></ul></pre>")
        assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
        assert !nodeDetails.contains(DETAILS_LABEL_REASON)
        assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert !nodeDetails.contains(DETAILS_LABEL_CLASS_TRAITS)

        //Edge from top level node to enum
        Map edge = edges.find { Map edge -> 'FCoverage' == edge.fromName && 'Coverage.Coverages' == edge.toName}
        assert 'Coverages' == edge.fromFieldName
        assert '2' == edge.level
        assert 'Coverages' == edge.label
        assert "Field Coverages cardinality ${V_MIN_CARDINALITY}:${V_MAX_CARDINALITY}".toString() == edge.title

        //Enum node under top level node
        node = nodes.find { Map node1 -> "${VALID_VALUES_FOR_FIELD_SENTENCE_CASE}Coverages on FCoverage".toString() == node1.title}
        assert 'rpm.enum.Coverage.Coverages' == node.cubeName
        assert null == node.label
        assert 'Coverages' == node.fromFieldName
        assert "${VALID_VALUES_FOR_FIELD_SENTENCE_CASE}Coverages on FCoverage".toString() == node.detailsTitle1
        assert null == node.detailsTitle2
        assert 'COVERAGE_ENUM' == node.group
        assert '2' == node.level
        assert 'rpm.class.Coverage' == node.sourceCubeName
        assert 'FCoverage' == node.sourceDescription
        assert enumScope == node.scope
        assert enumScope == node.availableScope
        assert null == node.typesToAdd
        assert true == node.showCellValuesLink
        assert false == node.showCellValues
        assert true == node.cellValuesLoaded
        nodeDetails = node.details as String
        assert nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
        assert nodeDetails.contains("${DETAILS_LABEL_FIELDS}</b><pre><ul><li>CCCoverage</li><li>ICoverage</li></ul></pre>")
        assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
        assert !nodeDetails.contains(DETAILS_LABEL_REASON)
        assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert !nodeDetails.contains(DETAILS_LABEL_CLASS_TRAITS)

        //Edge from enum to target node
        edge = edges.find { Map edge1 -> 'Coverage.Coverages' == edge1.fromName && 'CCCoverage' == edge1.toName}
        assert 'CCCoverage' == edge.fromFieldName
        assert '3' == edge.level
        assert !edge.label
        assert "Valid value CCCoverage cardinality ${V_MIN_CARDINALITY}:${V_MAX_CARDINALITY}".toString() == edge.title

        //Target node of top level node
        node = nodes.find { Map node1 -> 'CCCoverage' == node1.label}
        assert 'rpm.class.Coverage' == node.cubeName
        assert 'CCCoverage' == node.fromFieldName
        assert 'Coverage' == node.title
        assert 'Coverage' == node.detailsTitle1
        assert 'CCCoverage' == node.detailsTitle2
        assert 'COVERAGE' == node.group
        assert '3' == node.level
        assert 'rpm.enum.Coverage.Coverages' == node.sourceCubeName
        assert 'field Coverages on FCoverage' == node.sourceDescription
        assert ['Coverage', 'Deductible', 'Limit', 'Premium', 'Rate', 'Ratefactor', 'Role'] == node.typesToAdd
        assert true == node.showCellValuesLink
        assert false == node.showCellValues
        assert true == node.cellValuesLoaded
        assert cCoverageScope == node.scope
        assert availableCCCoverageScope == node.availableScope
        nodeDetails = node.details as String
        assert nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
        assert nodeDetails.contains("${DETAILS_LABEL_FIELDS}</b><pre><ul><li>Exposure</li><li>Location</li><li>StatCode</li><li>field1</li><li>field2</li><li>field3</li><li>field4</li></ul></pre>")
        assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
        assert !nodeDetails.contains(DETAILS_LABEL_REASON)
        assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert !nodeDetails.contains(DETAILS_LABEL_CLASS_TRAITS)
    }

    @Test
    void testGetCellValues_classNode_showCellValues()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                          product          : 'WProduct',
                          policyControlDate: '2017-01-01',
                          quoteDate        : '2017-01-01',
                          sourceCoverage   : 'FCoverage',
                          coverage         : 'CCCoverage',
                          sourceFieldName  : 'Coverages',
                          risk             : 'WProductOps',
                          businessDivisionCode: 'AAADIV']

        Map nodeScope = new CaseInsensitiveMap(scope)
        nodeScope.remove('sourceFieldName')

        Map oldNode = [
                id: '4',
                cubeName: 'rpm.class.Coverage',
                fromFieldName: 'CCCoverage',
                title: 'rpm.class.Coverage',
                level: '3',
                label: 'CCCoverage',
                scope: nodeScope,
                showCellValues: true,
                showCellValuesLink: true,
                cellValuesLoaded: false,
                availableScope: scope,
                typesToAdd: [],
          ]

        RpmVisualizerInfo visInfo = new RpmVisualizerInfo()
        visInfo.appId = appId
        visInfo.allGroupsKeys = ['PRODUCT', 'FORM', 'RISK', 'COVERAGE', 'CONTAINER', 'DEDUCTIBLE', 'LIMIT', 'RATE', 'RATEFACTOR', 'PREMIUM', 'PARTY', 'PLACE', 'ROLE', 'ROLEPLAYER', 'UNSPECIFIED'] as Set
        visInfo.groupSuffix = '_ENUM'
        visInfo.availableGroupsAllLevels = [] as Set

        Map options = [node: oldNode, visInfo: visInfo]

        Map graphInfo = visualizer.getCellValues(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        List<Map<String, Object>> edges = (graphInfo.visInfo as RpmVisualizerInfo).edges as List

        assert nodes.size() == 1
        assert edges.size() == 0

        Map node = nodes.find { Map node -> 'CCCoverage' == node.label}
        assert true == node.showCellValuesLink
        assert true == node.showCellValues
        assert true == node.cellValuesLoaded
        String nodeDetails = node.details as String
        assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE)
        assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
        assert nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
        assert nodeDetails.contains("Exposure</b></li><pre><ul><li>r:declared: true</li><li>r:exists: true</li><li>r:extends: DataElementInventory</li><li>r:rpmType: string</li></ul></pre><li><b>")
        assert nodeDetails.contains("Location</b></li><pre><ul><li>r:declared: true</li><li>r:exists: true</li><li>r:rpmType: Risk</li><li>v:max: 1</li><li>v:min: 0</li></ul></pre><li><b>")
        assert nodeDetails.contains("StatCode</b></li><pre><ul><li>r:declared: true</li><li>r:defaultValue: 1133</li><li>r:exists: true</li><li>r:extends: DataElementInventory[StatCode]</li><li>r:rpmType: string</li></ul></pre>")
        assert nodeDetails.contains("field1</b></li><pre><ul><li>r:declared: true</li><li>r:defaultValue: 1133</li><li>r:exists: true</li><li>r:extends: DataElementInventory</li><li>r:rpmType: string</li></ul></pre><li><b>")
        assert nodeDetails.contains("field2</b></li><pre><ul><li>r:declared: true</li><li>r:defaultValue: 1133</li><li>r:exists: true</li><li>r:extends: DataElementInventory</li><li>r:rpmType: string</li></ul></pre><li><b>")
        assert nodeDetails.contains("field3</b></li><pre><ul><li>r:declared: true</li><li>r:defaultValue: DEI default for field3</li><li>r:exists: true</li><li>r:extends: DataElementInventory</li><li>r:rpmType: string</li></ul></pre><li><b>")
        assert nodeDetails.contains("field4</b></li><pre><ul><li>r:declared: true</li><li>r:defaultValue: 1133</li><li>r:exists: true</li><li>r:extends: DataElementInventory</li><li>r:rpmType: string</li></ul></pre></ul></pre>")
        assert !nodeDetails.contains(DETAILS_LABEL_REASON)
        assert nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert nodeDetails.contains("${DETAILS_LABEL_CLASS_TRAITS}</b><pre><ul><li>r:exists: true</li><li>r:name: CCCoverage</li><li>r:scopedName: CCCoverage</li></ul></pre><br><b>")
    }


    @Test
    void testGetCellValues_classNode_showCellValues_withUnboundAxes()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     product          : 'WProduct',
                     policyControlDate: '2017-01-01',
                     quoteDate        : '2017-01-01',
                     sourceCoverage   : 'FCoverage',
                     coverage         : 'CCCoverage',
                     sourceFieldName  : 'Coverages',
                     risk             : 'WProductOps']

        Map nodeScope = new CaseInsensitiveMap(scope)
        nodeScope.remove('sourceFieldName')

        Map oldNode = [
                id: '4',
                cubeName: 'rpm.class.Coverage',
                fromFieldName: 'CCCoverage',
                title: 'rpm.class.Coverage',
                level: '3',
                label: 'CCCoverage',
                scope: nodeScope,
                showCellValues: true,
                showCellValuesLink: true,
                cellValuesLoaded: false,
                availableScope: scope,
                typesToAdd: [],
        ]

        RpmVisualizerInfo visInfo = new RpmVisualizerInfo()
        visInfo.appId = appId
        visInfo.allGroupsKeys = ['PRODUCT', 'FORM', 'RISK', 'COVERAGE', 'CONTAINER', 'DEDUCTIBLE', 'LIMIT', 'RATE', 'RATEFACTOR', 'PREMIUM', 'PARTY', 'PLACE', 'ROLE', 'ROLEPLAYER', 'UNSPECIFIED'] as Set
        visInfo.groupSuffix = '_ENUM'
        visInfo.availableGroupsAllLevels = [] as Set

        Map options = [node: oldNode, visInfo: visInfo]

        Map graphInfo = visualizer.getCellValues(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        Set<String> messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
        assert null == messages
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        List<Map<String, Object>> edges = (graphInfo.visInfo as RpmVisualizerInfo).edges as List

        assert nodes.size() == 1
        assert edges.size() == 0

        Map node = nodes.find { Map node -> 'CCCoverage' == node.label}
        assert true == node.showCellValuesLink
        assert true == node.showCellValues
        assert true == node.cellValuesLoaded
        String nodeDetails = node.details as String
        assert nodeDetails.contains(DETAILS_LABEL_NOTE)
        checkUnboundAxesMessage_CCCoverage(nodeDetails)
        assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE)
        assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
        assert nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
        assert nodeDetails.contains("Exposure</b></li><pre><ul><li>r:declared: true</li><li>r:exists: true</li><li>r:extends: DataElementInventory</li><li>r:rpmType: string</li></ul></pre><li><b>")
        assert nodeDetails.contains("Location</b></li><pre><ul><li>r:declared: true</li><li>r:exists: true</li><li>r:rpmType: Risk</li><li>v:max: 1</li><li>v:min: 0</li></ul></pre><li><b>")
        assert nodeDetails.contains("StatCode</b></li><pre><ul><li>r:declared: true</li><li>r:defaultValue: None</li><li>r:exists: true</li><li>r:extends: DataElementInventory[StatCode]</li><li>r:rpmType: string</li></ul></pre><li><b>")
        assert nodeDetails.contains("field1</b></li><pre><ul><li>r:declared: true</li><li>r:defaultValue: DEI default for field1</li><li>r:exists: true</li><li>r:extends: DataElementInventory</li><li>r:rpmType: string</li></ul></pre><li><b>")
        assert nodeDetails.contains("field2</b></li><pre><ul><li>r:declared: true</li><li>r:defaultValue: DEI default for field2</li><li>r:exists: true</li><li>r:extends: DataElementInventory</li><li>r:rpmType: string</li></ul></pre><li><b>")
        assert nodeDetails.contains("field3</b></li><pre><ul><li>r:declared: true</li><li>r:defaultValue: DEI default for field3</li><li>r:exists: true</li><li>r:extends: DataElementInventory</li><li>r:rpmType: string</li></ul></pre><li><b>")
        assert nodeDetails.contains("field4</b></li><pre><ul><li>r:declared: true</li><li>r:defaultValue: DEI default for field4</li><li>r:exists: true</li><li>r:extends: DataElementInventory</li><li>r:rpmType: string</li></ul></pre></ul></pre>")
        assert !nodeDetails.contains(DETAILS_LABEL_REASON)
        assert nodeDetails.contains("${DETAILS_LABEL_CLASS_TRAITS}</b><pre><ul><li>r:exists: true</li><li>r:name: CCCoverage</li><li>r:scopedName: CCCoverage</li></ul></pre><br><b>")
    }

    private static void checkUnboundAxesMessage_CCCoverage(String message)
    {
        assert message.contains("${OPTIONAL_SCOPE_AVAILABLE_TO_LOAD}CCCoverage of type Coverage.")

        assert message.contains("${ADD_SCOPE_VALUE_FOR_OPTIONAL_KEY}businessDivisionCode")
        assert message.contains('AAADIV')
        assert message.contains('BBBDIV')

        assert message.contains("${ADD_SCOPE_VALUE_FOR_OPTIONAL_KEY}program")
        assert message.contains('program1')
        assert message.contains('program2')
        assert message.contains('program3')

        assert message.contains("${ADD_SCOPE_VALUE_FOR_OPTIONAL_KEY}type")
        assert message.contains('type1')
        assert message.contains('type2')
        assert message.contains('type3')
        assert message.contains('typeA')
        assert message.contains('typeB')

        assert message.contains('<option>Default (no value provided)</option>')
    }

    @Test
    void testGetCellValues_classNode_showCellValues_withURLs()
    {
        String httpsURL = 'https://mail.google.com'
        String fileURL = 'file:///C:/Users/bheekin/Desktop/honey%20badger%20thumbs%20up.jpg'
        String httpURL = 'http://www.google.com'
        String fileLink = """<a href="#" onclick='window.open("${fileURL}");return false;'>${fileURL}</a>"""
        String httpsLink = """<a href="#" onclick='window.open("${httpsURL}");return false;'>${httpsURL}</a>"""
        String httpLink = """<a href="#" onclick='window.open("${httpURL}");return false;'>${httpURL}</a>"""

        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     product          : 'WProduct',
                     policyControlDate: '2017-01-01',
                     quoteDate        : '2017-01-01',
                     coverage         : 'AdmCoverage',
                     sourceFieldName  : 'Coverages',
                     risk             : 'WProductOps',
                     businessDivisionCode: 'AAADIV']

        Map nodeScope = new CaseInsensitiveMap(scope)
        nodeScope.remove('sourceFieldName')

        Map oldNode = [
                id: '4',
                cubeName: 'rpm.class.Coverage',
                fromFieldName: 'AdmCoverage',
                title: 'rpm.class.Coverage',
                level: '3',
                label: 'AdmCoverage',
                scope: nodeScope,
                showCellValues: true,
                showCellValuesLink: true,
                cellValuesLoaded: false,
                availableScope: scope,
                typesToAdd: [],
        ]

        RpmVisualizerInfo visInfo = new RpmVisualizerInfo()
        visInfo.appId = appId
        visInfo.allGroupsKeys = ['PRODUCT', 'FORM', 'RISK', 'COVERAGE', 'CONTAINER', 'DEDUCTIBLE', 'LIMIT', 'RATE', 'RATEFACTOR', 'PREMIUM', 'PARTY', 'PLACE', 'ROLE', 'ROLEPLAYER', 'UNSPECIFIED'] as Set
        visInfo.groupSuffix = '_ENUM'
        visInfo.availableGroupsAllLevels = [] as Set

        Map options = [node: oldNode, visInfo: visInfo]

        Map graphInfo = visualizer.getCellValues(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        List<Map<String, Object>> edges = (graphInfo.visInfo as RpmVisualizerInfo).edges as List

        assert nodes.size() == 1
        assert edges.size() == 0

        Map node = nodes.find { Map node -> 'AdmCoverage' == node.label}
        assert true == node.showCellValuesLink
        assert true == node.showCellValues
        assert true == node.cellValuesLoaded
        String nodeDetails = node.details as String
        assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE)
        assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
        assert nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
        assert nodeDetails.contains("Exposure</b></li><pre><ul><li>r:declared: true</li><li>r:defaultValue: ${fileLink}</li><li>r:exists: true</li><li>r:extends: DataElementInventory</li><li>r:rpmType: string</li></ul></pre>")
        assert nodeDetails.contains("Location</b></li><pre><ul><li>r:declared: true</li><li>r:defaultValue: ${httpLink}</li><li>r:exists: true</li><li>r:rpmType: Risk</li><li>v:max: 1</li><li>v:min: 0</li></ul></pre><li><b>")
        assert nodeDetails.contains("StatCode</b></li><pre><ul><li>r:declared: true</li><li>r:defaultValue: ${httpsLink}</li><li>r:exists: true</li><li>r:extends: DataElementInventory[StatCode]</li><li>r:rpmType: string</li></ul></pre></ul></pre>")
        assert !nodeDetails.contains(DETAILS_LABEL_REASON)
        assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert nodeDetails.contains("${DETAILS_LABEL_CLASS_TRAITS}</b><pre><ul><li>r:exists: true</li><li>r:name: AdmCoverage</li><li>r:scopedName: AdmCoverage</li></ul></pre><br><b>")
    }

    @Test
    void testGetCellValues_enumNode_showCellValues()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     product          : 'WProduct',
                     policyControlDate: '2017-01-01',
                     quoteDate        : '2017-01-01',
                     coverage         : 'FCoverage',
                     sourceFieldName  : 'Coverages',
                     risk             : 'WProductOps']

          Map oldNode = [
                id: '2',
                cubeName: 'rpm.enum.Coverage.Coverages',
                fromFieldName: 'FCoverage',
                title: "${VALID_VALUES_FOR_FIELD_SENTENCE_CASE}Coverages on FCoverage",
                level: '2',
                scope: new CaseInsensitiveMap(scope),
                showCellValues: true,
                showCellValuesLink: true,
                cellValuesLoaded: false,
                availableScope: new CaseInsensitiveMap(scope),
                typesToAdd: [],
        ]

        RpmVisualizerInfo visInfo = new RpmVisualizerInfo()
        visInfo.allGroupsKeys = ['PRODUCT', 'FORM', 'RISK', 'COVERAGE', 'CONTAINER', 'DEDUCTIBLE', 'LIMIT', 'RATE', 'RATEFACTOR', 'PREMIUM', 'PARTY', 'PLACE', 'ROLE', 'ROLEPLAYER', 'UNSPECIFIED'] as Set
        visInfo.groupSuffix = '_ENUM'
        visInfo.availableGroupsAllLevels = [] as Set

        Map options = [node: oldNode, visInfo: visInfo]

        Map graphInfo = visualizer.getCellValues(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        List<Map<String, Object>> edges = (graphInfo.visInfo as RpmVisualizerInfo).edges as List

        assert nodes.size() == 1
        assert edges.size() == 0

        Map node = nodes.find { Map node1 -> "${VALID_VALUES_FOR_FIELD_SENTENCE_CASE}Coverages on FCoverage".toString() == node1.title}
        assert true == node.showCellValuesLink
        assert true == node.showCellValues
        assert true == node.cellValuesLoaded
        String nodeDetails = node.details as String
        assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE)
        assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
        assert nodeDetails.contains("${DETAILS_LABEL_FIELDS_AND_TRAITS}</b><pre><ul><li><b>CCCoverage</b></li><pre><ul><li>r:declared: true</li><li>r:exists: true</li><li>r:name: CCCoverage</li><li>v:max: 999999</li><li>v:min: 0</li></ul></pre><li><b>ICoverage</b></li><pre><ul><li>r:declared: true</li><li>r:exists: true</li><li>r:name: ICoverage</li><li>v:max: 1</li><li>v:min: 0</li></ul>")
        assert !nodeDetails.contains(DETAILS_LABEL_REASON)
        assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert nodeDetails.contains("${DETAILS_LABEL_CLASS_TRAITS}</b><pre><ul><li>r:exists: true</li></ul></pre><br><b>")
    }

    @Test
    void testGetCellValues_classNode_hideCellValues()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     product          : 'WProduct',
                     policyControlDate: '2017-01-01',
                     quoteDate        : '2017-01-01',
                     sourceCoverage   : 'FCoverage',
                     coverage         : 'CCCoverage',
                     sourceFieldName  : 'Coverages',
                     risk             : 'WProductOps']

        Map nodeScope = new CaseInsensitiveMap(scope)
        nodeScope.remove('sourceFieldName')

        Map oldNode = [
                id: '4',
                cubeName: 'rpm.class.Coverage',
                fromFieldName: 'CCCoverage',
                title: 'rpm.class.Coverage',
                level: '3',
                label: 'CCCoverage',
                scope: nodeScope,
                showCellValues: false,
                showCellValuesLink: true,
                cellValuesLoaded: true,
                availableScope: scope,
                typesToAdd: [],
        ]

        RpmVisualizerInfo visInfo = new RpmVisualizerInfo()
        visInfo.allGroupsKeys = ['PRODUCT', 'FORM', 'RISK', 'COVERAGE', 'CONTAINER', 'DEDUCTIBLE', 'LIMIT', 'RATE', 'RATEFACTOR', 'PREMIUM', 'PARTY', 'PLACE', 'ROLE', 'ROLEPLAYER', 'UNSPECIFIED'] as Set
        visInfo.groupSuffix = '_ENUM'
        visInfo.availableGroupsAllLevels = [] as Set

        Map options = [node: oldNode, visInfo: visInfo]

        Map graphInfo = visualizer.getCellValues(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        List<Map<String, Object>> edges = (graphInfo.visInfo as RpmVisualizerInfo).edges as List

        assert nodes.size() == 1
        assert edges.size() == 0

        Map node = nodes.find { Map node -> 'CCCoverage' == node.label}
        assert true == node.showCellValuesLink
        assert false == node.showCellValues
        assert true == node.cellValuesLoaded
        String nodeDetails = node.details as String
        assert nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
        assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
        assert nodeDetails.contains("${DETAILS_LABEL_FIELDS}</b><pre><ul><li>Exposure</li><li>Location</li><li>StatCode</li><li>field1</li><li>field2</li><li>field3</li><li>field4</li></ul></pre>")
        assert !nodeDetails.contains(DETAILS_LABEL_REASON)
        assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert !nodeDetails.contains(DETAILS_LABEL_CLASS_TRAITS)
    }

    @Test
    void testBuildGraph_initialPromptForScope()
    {
        Map scope = null

        String startCubeName = 'rpm.class.Product'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert  STATUS_MISSING_START_SCOPE == graphInfo.status
        Set messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
        assert 1 == messages.size()
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        List<Map<String, Object>> edges = (graphInfo.visInfo as RpmVisualizerInfo).edges as List
        assert 0 == nodes.size()
        assert 0 == edges.size()

        String message = messages.first()
        assert message.contains(SCOPE_VALUES_ADDED_FOR_REQUIRED_KEYS)
        assert message.contains('policyControlDate, quoteDate, _effectiveVersion')
        assert message.contains("${ADD_SCOPE_VALUE_FOR_REQUIRED_KEY}Product:")
        assert message.contains('GProduct')
        assert message.contains('UProduct')
        assert message.contains('WProduct')
        assert !message.contains('<option>Default</option>')
    }

    @Test
    void testBuildGraph_invalidScope()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     product:'xxxxxxxx',
                     policyControlDate:'2017-01-01',
                     quoteDate:'2017-01-01']

        String startCubeName = 'rpm.class.Product'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert  STATUS_SUCCESS == graphInfo.status
        Set<String> messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
        assert 1 == messages.size()
        checkInvalidScopeMessage(messages.first())

        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        List<Map<String, Object>> edges = (graphInfo.visInfo as RpmVisualizerInfo).edges as List
        assert 1 == nodes.size()
        assert 0 == edges.size()

        Map node = nodes.first()
        assert 'Product' == node.title
        assert 'Product' == node.detailsTitle1
        assert null == node.detailsTitle2
        assert "${SCOPE_VALUE_NOT_FOUND}xxxxxxxx".toString() == node.label
        assert false == node.showCellValuesLink
        assert false == node.showCellValues
        assert false == node.cellValuesLoaded
        String nodeDetails = node.details as String
        checkInvalidScopeMessage(nodeDetails)
        assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE)
        assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
        assert !nodeDetails.contains(DETAILS_LABEL_FIELDS)
        assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
        assert nodeDetails.contains(DETAILS_LABEL_REASON)
        assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert !nodeDetails.contains(DETAILS_LABEL_CLASS_TRAITS)
    }

    private static void checkInvalidScopeMessage(String message)
    {
        assert message.contains('The scope value xxxxxxxx for scope key product cannot be found on axis product in rpm.scope.class.Product.traits for xxxxxxxx.')
        assert message.contains("${ADD_SCOPE_VALUE_FOR_REQUIRED_KEY}product")
        assert message.contains('GProduct')
        assert message.contains('UProduct')
        assert message.contains('WProduct')
    }

    @Test
    void testBuildGraph_withUnboundAxes_withDerivedScopeKey_notTopNode()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     policyControlDate: '2017-01-01',
                     quoteDate        : '2017-01-01',
                     risk             : 'WProductOps']

        String startCubeName = 'rpm.class.Risk'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        Set messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
        assert 1 == messages.size()
        String message = messages.first()
        assert message.contains("${OPTIONAL_SCOPE_AVAILABLE_TO_LOAD}the graph.")
        assert !message.contains('A different scope value may be supplied for product:')

        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        Map node = nodes.find {Map node ->  'StateOps' == node.detailsTitle2}
        String nodeDetails = node.details as String
        assert !nodeDetails.contains('A different scope value may be supplied for product:')
    }

    @Test
    void testBuildGraph_withUnboundAxes_withDerivedScopeKey_topNode()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     policyControlDate: '2017-01-01',
                     quoteDate        : '2017-01-01',
                     sourceRisk       : 'WProductOps',
                     risk             : 'StateOps']

        String startCubeName = 'rpm.class.Risk'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        Set messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
        assert 1 == messages.size()
        String message = messages.first()
        assert message.contains("${OPTIONAL_SCOPE_AVAILABLE_TO_LOAD}the graph.")
        assert message.contains('<div id="product" title="The default for product was utilized on rpm.scope.class.Risk.traits.Coverages" class="input-group input-group-sm">')
        assert message.contains('A different scope value may be supplied for product:')
        assert message.contains('<option>Default (no value provided)</option>')
        assert message.contains('WProduct')
        assert message.contains('UProduct')
        assert message.contains('GProduct')

        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        Map node = nodes.find {Map node ->  'StateOps' == node.detailsTitle2}
        String nodeDetails = node.details as String
        assert nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert nodeDetails.contains("${OPTIONAL_SCOPE_AVAILABLE_TO_LOAD}StateOps of type Risk.")
        assert message.contains('<div id="product" title="The default for product was utilized on rpm.scope.class.Risk.traits.Coverages" class="input-group input-group-sm">')
        assert message.contains('A different scope value may be supplied for product:')
        assert message.contains('<option>Default (no value provided)</option>')
        assert nodeDetails.contains('WProduct')
        assert nodeDetails.contains('UProduct')
        assert nodeDetails.contains('GProduct')
    }

    @Test
    void testBuildGraph_withoutUnboundAxes_withDerivedScopeKey_notTopNode()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     policyControlDate: '2017-01-01',
                     quoteDate        : '2017-01-01',
                     product          : 'WProduct',
                     risk             : 'WProductOps']

        String startCubeName = 'rpm.class.Risk'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        Set messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
        assert 1 == messages.size()
        String message = messages.first()
        assert message.contains("${OPTIONAL_SCOPE_AVAILABLE_TO_LOAD}the graph.")
        assert message.contains("A different scope value may be supplied for businessDivisionCode:")
        assert !message.contains('A different scope value may be supplied for product:')

        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        Map node = nodes.find {Map node ->  'StateOps' == node.detailsTitle2}
        String nodeDetails = node.details as String
        assert !nodeDetails.contains('A different scope value may be supplied for product:')
    }

    @Test
    void testBuildGraph_missingRequiredScope()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     policyControlDate:'2017-01-01',
                     quoteDate:'2017-01-01',
                     product: 'AProduct',
                     risk: 'BRisk']

        String startCubeName = 'rpm.class.Risk'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        Set messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
        assert 1 == messages.size()
        //checkAdditionalScopeIsRequiredMessage(messages.first() as String)

        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        Map node = nodes.find {Map node ->  "${ADDITIONAL_SCOPE_REQUIRED_FOR}BRisk".toString() == node.label}
        assert 'Risk' == node.title
        assert 'Risk' == node.detailsTitle1
        assert null == node.detailsTitle2
        assert false == node.showCellValuesLink
        assert false == node.showCellValues
        assert false == node.cellValuesLoaded
        String nodeDetails = node.details as String
        assert nodeDetails.contains("*** ${UNABLE_TO_LOAD}fields and traits for BRisk")
        assert nodeDetails.contains(DETAILS_LABEL_REASON)
        checkAdditionalScopeIsRequiredMessage(nodeDetails)
        assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE)
        assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
        assert !nodeDetails.contains(DETAILS_LABEL_FIELDS)
        assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
        assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert !nodeDetails.contains(DETAILS_LABEL_CLASS_TRAITS)
    }

    @Test
    void testBuildGraph_missingRequiredScope_nonEPM()
    {
        NCube cube = NCubeManager.getCube(appId, 'rpm.class.party.ProfitCenter')
        try
        {
            //Change cube to have declared required scope
            cube.setMetaProperty('requiredScopeKeys', ['dummyRequiredScopeKey'])
            Map scope = null
            String startCubeName = 'rpm.class.partyrole.LossPrevention'
            Map options = [startCubeName: startCubeName, scope: scope]

            Map graphInfo = visualizer.buildGraph(appId, options)
            assert STATUS_SUCCESS == graphInfo.status
            Set messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
            assert 1 == messages.size()
            checkAdditionalScopeIsRequiredNonEPMMessage(messages.first() as String)
            List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
            List<Map<String, Object>> edges = (graphInfo.visInfo as RpmVisualizerInfo).edges as List

            assert nodes.size() == 4
            assert edges.size() == 3

            Map node = nodes.find { Map node -> "${ADDITIONAL_SCOPE_REQUIRED_FOR}party.ProfitCenter".toString() == node.label}
            assert 'party.ProfitCenter' == node.title
            assert 'party.ProfitCenter' == node.detailsTitle1
            assert null == node.detailsTitle2
            assert false == node.showCellValuesLink
            assert false == node.showCellValues
            assert false == node.cellValuesLoaded
            String nodeDetails = node.details as String
            assert nodeDetails.contains("*** ${UNABLE_TO_LOAD}fields and traits for party.ProfitCenter")
            assert nodeDetails.contains(DETAILS_LABEL_REASON)
            checkAdditionalScopeIsRequiredNonEPMMessage(nodeDetails)
            assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
            assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE)
            assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
            assert !nodeDetails.contains(DETAILS_LABEL_FIELDS)
            assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
            assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
            assert !nodeDetails.contains(DETAILS_LABEL_CLASS_TRAITS)
        }
        finally
        {
            //Reset cube
            cube.removeMetaProperty('requiredScopeKeys')
        }
    }

    private static void checkAdditionalScopeIsRequiredNonEPMMessage(String message)
    {
        assert message.contains("${ADDITIONAL_SCOPE_REQUIRED_TO_LOAD}party.ProfitCenter, the target of partyrole.BasePartyRole.Parties.")
        assert message.contains('A scope value must be entered manually for dummyRequiredScopeKey since there are no values to choose from: ')
        assert message.contains("""<input class="missingScopeInput" title="dummyRequiredScopeKey" style="color: black;" type="text" placeholder="Enter value..." ></div>""")
    }


    private static void checkAdditionalScopeIsRequiredMessage(String message)
    {
        assert message.contains("${ADDITIONAL_SCOPE_REQUIRED_TO_LOAD}rpm.scope.class.Risk.traits.fieldBRisk for BRisk.")
        assert message.contains("${ADD_SCOPE_VALUE_FOR_REQUIRED_KEY}pgm:")
        assert message.contains('pgm3')
        assert !message.contains('<option>Default</option>')
    }

    @Test
    void testBuildGraph_cubeNotFound()
    {
        NCube cube = NCubeManager.getCube(appId, 'rpm.enum.partyrole.BasePartyRole.Parties')
        try
        {
            //Change enum to have reference to non-existing cube
            cube.addColumn((AXIS_NAME), 'party.NoCubeExists')
            cube.setCell(true,[name:'party.NoCubeExists', trait: R_EXISTS])
            Map scope = null
            String startCubeName = 'rpm.class.partyrole.LossPrevention'
            Map options = [startCubeName: startCubeName, scope: scope]

            Map graphInfo = visualizer.buildGraph(appId, options)
            assert STATUS_SUCCESS == graphInfo.status
            Set messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
            assert 1 == messages.size()
            assert 'No cube exists with name of rpm.class.party.NoCubeExists. Cube not included in the visualization.' == messages.first()
        }
        finally
        {
            //Reset cube
            cube.deleteColumn((AXIS_NAME), 'party.NoCubeExists')
            assert !cube.findColumn(AXIS_NAME, 'party.NoCubeExists')
        }
    }

    @Test
    void testBuildGraph_missingRequiredScopeWithNoPreLoadedAvailableScopeValues()
    {
        String axisName = 'dummyAxis'

        try
        {
            //Change cube to have a required axis that won't be on the input as the class is loaded
            NCube cube = NCubeManager.getCube(appId, 'rpm.class.Coverage')
            cube.addAxis(new Axis(axisName, AxisType.DISCRETE, AxisValueType.STRING, false, Axis.SORTED, 3))
            cube.addColumn(axisName, 'dummy1')
            cube.addColumn(axisName, 'dummy2')
            cube.addColumn(axisName, 'dummy3')

            Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                         product          : 'WProduct',
                         policyControlDate: '2017-01-01',
                         quoteDate        : '2017-01-01',
                         risk             : 'WProductOps']

            String startCubeName = 'rpm.class.Risk'
            Map options = [startCubeName: startCubeName, scope: scope]

            Map graphInfo = visualizer.buildGraph(appId, options)
            assert STATUS_SUCCESS == graphInfo.status
            Set messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
            assert 1 == messages.size()
            String message = messages.first()
            assert message.contains("${ADDITIONAL_SCOPE_REQUIRED_TO_LOAD}FCoverage, the target of Risk.Coverages.")
            assert message.contains("${ADDITIONAL_SCOPE_REQUIRED_TO_LOAD}AdmCoverage, the target of Risk.Coverages.")
            checkMissingRequiredScopeMessage(message)

            List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
            Map node = nodes.find {Map node ->  "${ADDITIONAL_SCOPE_REQUIRED_FOR}FCoverage".toString() == node.label}
            assert 'Coverage' == node.title
            assert 'Coverage' == node.detailsTitle1
            assert null == node.detailsTitle2
            assert false == node.showCellValuesLink
            assert false == node.showCellValues
            assert false == node.cellValuesLoaded
            String nodeDetails = node.details as String
            assert nodeDetails.contains("*** ${UNABLE_TO_LOAD}fields and traits for FCoverage")
            assert nodeDetails.contains(DETAILS_LABEL_REASON)
            assert nodeDetails.contains("${ADDITIONAL_SCOPE_REQUIRED_TO_LOAD}FCoverage, the target of Risk.Coverages.")
            checkMissingRequiredScopeMessage(nodeDetails)
            assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
            assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE)
            assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
            assert !nodeDetails.contains(DETAILS_LABEL_FIELDS)
            assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
            assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
            assert !nodeDetails.contains(DETAILS_LABEL_CLASS_TRAITS)
        }
        finally
        {
            //Reset cube
            NCubeManager.loadCube(appId, 'rpm.class.Coverage')
        }
    }

    private static void checkMissingRequiredScopeMessage(String message)
    {
        assert message.contains("${ADD_SCOPE_VALUE_FOR_REQUIRED_KEY}dummyAxis")
        assert message.contains('dummy1')
        assert message.contains('dummy2')
        assert message.contains('dummy3')
        assert !message.contains('<option>Default</option>')
    }

    @Test
    void testBuildGraph_missingDeclaredRequiredScope()
    {
        NCube cube = NCubeManager.getCube(appId, 'rpm.class.Coverage')
        try
        {
            //Change cube to have declared required scope
            cube.setMetaProperty('requiredScopeKeys', ['dummyRequiredScopeKey'])

            Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                         product          : 'WProduct',
                         policyControlDate: '2017-01-01',
                         quoteDate        : '2017-01-01',
                         risk             : 'WProductOps']

            String startCubeName = 'rpm.class.Risk'
            Map options = [startCubeName: startCubeName, scope: scope]

            Map graphInfo = visualizer.buildGraph(appId, options)
            assert STATUS_SUCCESS == graphInfo.status
            Set messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
            assert 1 == messages.size()

            List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List

            String message = messages.first()
            assert message.contains("${ADDITIONAL_SCOPE_REQUIRED_TO_LOAD}FCoverage, the target of Risk.Coverages.")
            assert message.contains("${ADDITIONAL_SCOPE_REQUIRED_TO_LOAD}AdmCoverage, the target of Risk.Coverages.")
            assert message.contains('A scope value must be entered manually for dummyRequiredScopeKey since there are no values to choose from: ')
            assert message.contains("""<input class="missingScopeInput" title="dummyRequiredScopeKey" style="color: black;" type="text" placeholder="Enter value..." ></div>""")

            Map node = nodes.find {Map node ->  "${ADDITIONAL_SCOPE_REQUIRED_FOR}FCoverage".toString() == node.label}
            assert 'Coverage' == node.title
            assert 'Coverage' == node.detailsTitle1
            assert null == node.detailsTitle2
            assert false == node.showCellValuesLink
            assert false == node.showCellValues
            assert false == node.cellValuesLoaded
            String nodeDetails = node.details as String
            assert nodeDetails.contains("*** ${UNABLE_TO_LOAD}fields and traits for FCoverage")
            assert nodeDetails.contains(DETAILS_LABEL_REASON)
            assert nodeDetails.contains("${ADDITIONAL_SCOPE_REQUIRED_TO_LOAD}FCoverage, the target of Risk.Coverages.")
            assert nodeDetails.contains('A scope value must be entered manually for dummyRequiredScopeKey since there are no values to choose from: ')
            assert nodeDetails.contains("""<input class="missingScopeInput" title="dummyRequiredScopeKey" style="color: black;" type="text" placeholder="Enter value..." ></div>""")
            assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
            assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE)
            assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
            assert !nodeDetails.contains(DETAILS_LABEL_FIELDS)
            assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
            assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
            assert !nodeDetails.contains(DETAILS_LABEL_CLASS_TRAITS)
        }
        finally
        {
            //Reset cube
            cube.removeMetaProperty('requiredScopeKeys')
        }
    }

    @Test
    void testBuildGraph_missingMinimumTypeScopeKeyAndValue()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     policyControlDate:'2017-01-01',
                     quoteDate:'2017-01-01']

        String startCubeName = 'rpm.class.Product'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_MISSING_START_SCOPE == graphInfo.status
        RpmVisualizerInfo visInfo = graphInfo.visInfo as RpmVisualizerInfo
        Set<String> messages = visInfo.messages
        assert 1 == messages.size()

        List<Map<String, Object>> nodes = visInfo.nodes as List
        List<Map<String, Object>> edges = visInfo.edges as List
        assert 0 == nodes.size()
        assert 0 == edges.size()

        checkMissingMinimumTypeScopeMessage(messages.first())
    }

    @Test
    void testBuildGraph_missingMinimumTypeScopeValue()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     product: null,
                     policyControlDate:'2017-01-01',
                     quoteDate:'2017-01-01']

        String startCubeName = 'rpm.class.Product'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_MISSING_START_SCOPE == graphInfo.status
        RpmVisualizerInfo visInfo = graphInfo.visInfo as RpmVisualizerInfo
        Set<String> messages = visInfo.messages
        assert 1 == messages.size()

        List<Map<String, Object>> nodes = visInfo.nodes as List
        List<Map<String, Object>> edges = visInfo.edges as List
        assert 0 == nodes.size()
        assert 0 == edges.size()

        checkMissingMinimumTypeScopeMessage(messages.first())
    }

    private static void checkMissingMinimumTypeScopeMessage(String message)
    {
        assert message.contains("${ADD_SCOPE_VALUE_FOR_REQUIRED_KEY}Product")
        assert message.contains('GProduct')
        assert message.contains('UProduct')
        assert message.contains('WProduct')
    }

    @Test
    void testBuildGraph_missingMinimumDateScope()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     product:'WProduct']

        String startCubeName = 'rpm.class.Product'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_MISSING_START_SCOPE == graphInfo.status
        RpmVisualizerInfo visInfo = graphInfo.visInfo as RpmVisualizerInfo
        Set messages = visInfo.messages
        assert 1 == messages.size()

        List<Map<String, Object>> nodes = visInfo.nodes as List
        List<Map<String, Object>> edges = visInfo.edges as List
        assert 0 == nodes.size()
        assert 0 == edges.size()

        String message = messages.first()
        assert message.contains('Scope for policyControlDate was added since required. The scope value may be changed as desired.')
        assert message.contains('Scope for quoteDate was added since required. The scope value may be changed as desired.')
        assert DATE_TIME_FORMAT.format(new Date()) == visInfo.scope.policyControlDate
        assert DATE_TIME_FORMAT.format(new Date()) == visInfo.scope.quoteDate
    }


    @Test
    void testBuildGraph_missingMinimumEffectiveVersionScope()
    {
        Map scope = [product: 'WProduct',
                     policyControlDate:'2017-01-01',
                     quoteDate:'2017-01-01']

        String startCubeName = 'rpm.class.Product'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_MISSING_START_SCOPE == graphInfo.status
        RpmVisualizerInfo visInfo = graphInfo.visInfo as RpmVisualizerInfo
        Set messages = visInfo.messages
        assert 1 == messages.size()

        List<Map<String, Object>> nodes = visInfo.nodes as List
        List<Map<String, Object>> edges = visInfo.edges as List
        assert 0 == nodes.size()
        assert 0 == edges.size()

        String message = messages.first()
        assert message.contains('Scope for _effectiveVersion was added since required. The scope value may be changed as desired.')
        assert appId.version == visInfo.scope._effectiveVersion
    }

    @Test
    void testBuildGraph_effectiveVersionApplied_beforeFieldAddAndObsolete()
    {
        Map scope = [product: 'WProduct',
                     policyControlDate:'2017-01-01',
                     quoteDate:'2017-01-01',
                     _effectiveVersion: '1.0.0']

        String startCubeName = 'rpm.class.Product'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List

        Map node = nodes.find { Map node1 -> 'WProduct' == node1.label}
        String nodeDetails = node.details as String
        assert nodeDetails.contains("${DETAILS_LABEL_FIELDS}</b><pre><ul><li>CurrentCommission</li><li>CurrentExposure</li><li>Risks</li><li>fieldObsolete101</li></ul></pre>")
    }

    @Test
    void testBuildGraph_effectiveVersionApplied_beforeFieldAddAfterFieldObsolete()
    {
        Map scope = [product: 'WProduct',
                     policyControlDate:'2017-01-01',
                     quoteDate:'2017-01-01',
                     _effectiveVersion: '1.0.1']

        String startCubeName = 'rpm.class.Product'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List

        Map node = nodes.find { Map node1 -> 'WProduct' == node1.label}
        String nodeDetails = node.details as String
        assert nodeDetails.contains("${DETAILS_LABEL_FIELDS}</b><pre><ul><li>CurrentCommission</li><li>CurrentExposure</li><li>Risks</li></ul></pre>")
    }

    @Test
    void testBuildGraph_effectiveVersionApplied_afterFieldAddAndObsolete()
    {
        Map scope = [product: 'WProduct',
                     policyControlDate:'2017-01-01',
                     quoteDate:'2017-01-01',
                     _effectiveVersion: '1.0.2']

        String startCubeName = 'rpm.class.Product'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List

        Map node = nodes.find { Map node1 -> 'WProduct' == node1.label}
        String nodeDetails = node.details as String
        assert nodeDetails.contains("${DETAILS_LABEL_FIELDS}</b><pre><ul><li>CurrentCommission</li><li>CurrentExposure</li><li>Risks</li><li>fieldAdded102</li></ul></pre>")
    }

    @Test
    void testBuildGraph_withUnboundAxes()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     product:'WProduct',
                     policyControlDate:'2017-01-01',
                     quoteDate:'2017-01-01',
                     businessDivisionCode: 'bogusDIV']

        String startCubeName = 'rpm.class.Product'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        Set<String> messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
        assert 1 == messages.size()
        String message = messages.first()
        assert message.contains("${OPTIONAL_SCOPE_AVAILABLE_TO_LOAD}the graph.")
        assert message.contains('<div id="businessDivisionCode" title="The default for businessDivisionCode was utilized on rpm.scope.enum.Risk.Risks.traits')
        assert message.contains("A different scope value may be supplied for businessDivisionCode:")
        assert message.contains('<option>Default (bogusDIV provided, but not found)</option>')
        assert message.contains('<option title="businessDivisionCode: AAADIV">AAADIV</option>')
        assert message.contains('<option title="businessDivisionCode: BBBDIV">BBBDIV</option>')
        assert !message.contains('<option title="businessDivisionCode: CCCDIV">CCCDIV</option>')

        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List

        Map node = nodes.find { Map node1 -> "${VALID_VALUES_FOR_FIELD_SENTENCE_CASE}Risks on WProductOps".toString() == node1.title}
        String nodeDetails = node.details as String
        assert nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert nodeDetails.contains("${OPTIONAL_SCOPE_AVAILABLE_TO_LOAD}${VALID_VALUES_FOR_FIELD_LOWER_CASE}Risks on WProductOps.")
        assert nodeDetails.contains('<div id="businessDivisionCode" title="The default for businessDivisionCode was utilized on rpm.scope.enum.Risk.Risks.traits')
        assert nodeDetails.contains("A different scope value may be supplied for businessDivisionCode:")
        assert nodeDetails.contains('<option>Default (bogusDIV provided, but not found)</option>')
        assert nodeDetails.contains('<option title="businessDivisionCode: AAADIV">AAADIV</option>')
        assert nodeDetails.contains('<option title="businessDivisionCode: BBBDIV">BBBDIV</option>')
        assert !nodeDetails.contains('<option title="businessDivisionCode: CCCDIV">CCCDIV</option>')

    }

    @Test
    void testBuildGraph_withUnboundAxes_defaultIsOnlyValue()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     product:'BProduct',
                     policyControlDate:'2017-01-01',
                     quoteDate:'2017-01-01']

        String startCubeName = 'rpm.class.Product'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        Set<String> messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
        assert 1 == messages.size()
        String message = messages.first()
        assert message.contains("${OPTIONAL_SCOPE_AVAILABLE_TO_LOAD}the graph.")
        checkStateOptionalScopeMessage(messages.first())

        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List

        Map node = nodes.find { Map node1 -> 'DRisk' == node1.label}
        String nodeDetails = node.details as String
        assert nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert nodeDetails.contains("${OPTIONAL_SCOPE_AVAILABLE_TO_LOAD}DRisk")
        checkStateOptionalScopeMessage(nodeDetails)
    }

    private static void checkStateOptionalScopeMessage(String message)
    {
        assert message.contains('<div id="state" title="The default for state was utilized on rpm.scope.class.Risk.traits.fieldDRisk')
        assert message.contains("Default is the only option for state:")
        assert message.contains('<option>Default (no value provided)</option>')
    }


    @Test
    void testBuildGraph_missingMinimumTypeScopeUnChanged()
    {
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                     policyControlDate:'2017-01-01',
                     quoteDate:'2017-01-01']

        String startCubeName = 'rpm.class.Product'
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_MISSING_START_SCOPE == graphInfo.status
        RpmVisualizerInfo visInfo = graphInfo.visInfo as RpmVisualizerInfo
        Set<String> messages = visInfo.messages
        assert 1 == messages.size()

        List<Map<String, Object>> nodes = visInfo.nodes as List
        List<Map<String, Object>> edges = visInfo.edges as List
        assert 0 == nodes.size()
        assert 0 == edges.size()

        checkMissingMinimumTypeScopeMessage(messages.first())
    }

    @Test
    void testBuildGraph_validMinimalRpmClass()
    {
        String startCubeName = 'rpm.class.ValidRpmClass'
        createNCubeWithValidRpmClass(startCubeName)
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION]
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        checkValidRpmClass( startCubeName, scope, graphInfo)
    }

    @Test
    void testBuildGraph_notStartWithRpmClass()
    {
        String startCubeName = 'ValidRpmClass'
        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION]
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_INVALID_START_CUBE == graphInfo.status
        Set messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
        assert 1 == messages.size()
        String message = messages.first()
        assert "Starting cube for visualization must begin with 'rpm.class', n-cube ${startCubeName} does not.".toString() == message
    }

    @Test
    void testBuildGraph_noTraitAxis()
    {
        String startCubeName = 'rpm.class.ValidRpmClass'
        createNCubeWithValidRpmClass(startCubeName)
        NCube cube = NCubeManager.getCube(appId, startCubeName)
        cube.deleteAxis(AXIS_TRAIT)

        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION]
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_INVALID_START_CUBE == graphInfo.status
        Set messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
        assert 1 == messages.size()
        String message = messages.first()
        assert "Cube ${startCubeName} is not a valid rpm class since it does not have both a field axis and a traits axis.".toString() == message
    }

    @Test
    void testBuildGraph_noFieldAxis()
    {
        String startCubeName = 'rpm.class.ValidRpmClass'
        createNCubeWithValidRpmClass(startCubeName)
        NCube cube = NCubeManager.getCube(appId, startCubeName)
        cube.deleteAxis(AXIS_FIELD)

        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION]
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_INVALID_START_CUBE == graphInfo.status
        Set messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
        assert 1 == messages.size()
        String message = messages.first()
        assert "Cube ${startCubeName} is not a valid rpm class since it does not have both a field axis and a traits axis.".toString() == message
    }

    @Test
    void testBuildGraph_no_CLASSTRAITS_Field()
    {
        String startCubeName = 'rpm.class.ValidRpmClass'
        createNCubeWithValidRpmClass(startCubeName)
        NCube cube = NCubeManager.getCube(appId, startCubeName)
        cube.getAxis(AXIS_FIELD).columns.remove(CLASS_TRAITS)

        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION]
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        checkValidRpmClass( startCubeName, scope, graphInfo)
    }

    @Test
    void testBuildGraph_no_rExists_trait()
    {
        String startCubeName = 'rpm.class.ValidRpmClass'
        createNCubeWithValidRpmClass(startCubeName)
        NCube cube = NCubeManager.getCube(appId, startCubeName)
        cube.getAxis(AXIS_TRAIT).columns.remove(R_EXISTS)

        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION]
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        checkValidRpmClass( startCubeName, scope, graphInfo)
    }

    @Test
    void testBuildGraph_no_rRpmType_trait()
    {
        String startCubeName = 'rpm.class.ValidRpmClass'
        createNCubeWithValidRpmClass(startCubeName)
        NCube cube = NCubeManager.getCube(appId, startCubeName)
        cube.getAxis(AXIS_TRAIT).columns.remove(R_RPM_TYPE)

        Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION]
        Map options = [startCubeName: startCubeName, scope: scope]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        assert !(graphInfo.visInfo as RpmVisualizerInfo).messages
        checkValidRpmClass( startCubeName, scope, graphInfo)
    }

    @Test
    void testBuildGraph_invokedWithParentVisualizerInfoClass()
    {
        Map startScope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                          product          : 'WProduct',
                          policyControlDate: '2017-01-01',
                          quoteDate        : '2017-01-01',
                          coverage         : 'FCoverage',
                          risk             : 'WProductOps']

        String startCubeName = 'rpm.class.Coverage'
        VisualizerInfo notRpmVisInfo = new VisualizerInfo()
        notRpmVisInfo.groupSuffix = 'shouldGetReset'

        Map options = [startCubeName: startCubeName, scope: startScope, visInfo: notRpmVisInfo]

        Map graphInfo = visualizer.buildGraph(appId, options)
        assert STATUS_SUCCESS == graphInfo.status
        RpmVisualizerInfo rpmVisInfo = graphInfo.visInfo as RpmVisualizerInfo
        assert null == rpmVisInfo.messages

        assert 'RpmVisualizerInfo' == rpmVisInfo.class.simpleName
        assert '_ENUM' ==  rpmVisInfo.groupSuffix

        Map node = rpmVisInfo.nodes.find { Map node ->'FCoverage' == node.label}
        assert 'COVERAGE' == node.group
    }

    @Test
    void testBuildGraph_exceptionInTrait()
    {
        NCube cube = NCubeManager.getCube(appId, 'rpm.scope.class.Coverage.traits')
        Map coordinate = [(AXIS_FIELD): 'Exposure', (AXIS_TRAIT): R_EXISTS, coverage: 'FCoverage'] as Map

        try
        {
            //Change r:exists trait for FCoverage to throw an exception
            String expression = 'int a = 5; int b = 0; return a / b'
            cube.setCell(new GroovyExpression(expression, null, false), coordinate)

            Map scope = [_effectiveVersion: ApplicationID.DEFAULT_VERSION,
                         product          : 'WProduct',
                         policyControlDate: '2017-01-01',
                         quoteDate        : '2017-01-01']

            String startCubeName = 'rpm.class.Product'
            Map options = [startCubeName: startCubeName, scope: scope]

            Map graphInfo = visualizer.buildGraph(appId, options)
            assert STATUS_SUCCESS == graphInfo.status
            Set<String> messages = (graphInfo.visInfo as RpmVisualizerInfo).messages
            assert 1 == messages.size()
            List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
            checkExceptionMessage(messages.first())

            Map node = nodes.find {Map node -> 'Unable to load FCoverage' == node.label}
            assert 'Coverage' == node.title
            assert 'Coverage' == node.detailsTitle1
            assert null == node.detailsTitle2
            String nodeDetails = node.details as String
            assert nodeDetails.contains("*** ${UNABLE_TO_LOAD}fields and traits for FCoverage")
            assert nodeDetails.contains(DETAILS_LABEL_REASON)
            checkExceptionMessage(nodeDetails)
            assert false == node.showCellValuesLink
            assert false == node.showCellValues
            assert false == node.cellValuesLoaded
            assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
            assert !nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE)
            assert nodeDetails.contains(DETAILS_LABEL_AVAILABLE_SCOPE)
            assert nodeDetails.contains(DETAILS_LABEL_FIELDS)
            assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
            assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
            assert !nodeDetails.contains(DETAILS_LABEL_CLASS_TRAITS)
        }
        finally
        {
            //Reset cube
            cube.setCell(new GroovyExpression('true', null, false), coordinate)
        }
    }

    private static void checkExceptionMessage(String message)
    {
        assert message.contains("An exception was thrown while loading FCoverage")
        assert message.contains(DETAILS_LABEL_MESSAGE)
        assert message.contains(DETAILS_LABEL_ROOT_CAUSE)
        assert message.contains('java.lang.ArithmeticException: Division by zero')
        assert message.contains(DETAILS_LABEL_STACK_TRACE)
    }

    private  static checkValidRpmClass( String startCubeName, Map scope,  Map graphInfo)
    {
        List<Map<String, Object>> nodes = (graphInfo.visInfo as RpmVisualizerInfo).nodes as List
        List<Map<String, Object>> edges = (graphInfo.visInfo as RpmVisualizerInfo).edges as List

        assert nodes.size() == 1
        assert edges.size() == 0
        Map node = nodes.find { startCubeName == (it as Map).cubeName}
        assert 'ValidRpmClass' == node.title
        assert 'ValidRpmClass' == node.detailsTitle1
        assert null == node.detailsTitle2
        assert 'ValidRpmClass' == node.label
        assert  null == node.typesToAdd
        assert UNSPECIFIED == node.group
        assert null == node.fromFieldName
        assert '1' ==  node.level
        assert scope == node.scope
        String nodeDetails = node.details as String
        assert nodeDetails.contains(DETAILS_LABEL_UTILIZED_SCOPE_WITHOUT_ALL_TRAITS)
        assert nodeDetails.contains("${DETAILS_LABEL_FIELDS}</b><pre><ul></ul></pre>")
        assert !nodeDetails.contains(DETAILS_LABEL_FIELDS_AND_TRAITS)
        assert !nodeDetails.contains(DETAILS_LABEL_REASON)
        assert !nodeDetails.contains(DETAILS_LABEL_NOTE)
        assert !nodeDetails.contains(DETAILS_LABEL_CLASS_TRAITS)
    }

    private NCube createNCubeWithValidRpmClass(String cubeName)
    {
        NCube cube = new NCube(cubeName)
        cube.applicationID = appId
        String axisName = AXIS_FIELD
        cube.addAxis(new Axis(axisName, AxisType.DISCRETE, AxisValueType.STRING, false, Axis.SORTED, 1))
        cube.addColumn(axisName, CLASS_TRAITS)
        axisName = AXIS_TRAIT
        cube.addAxis(new Axis(axisName, AxisType.DISCRETE, AxisValueType.STRING, false, Axis.SORTED, 2))
        cube.addColumn(axisName, R_EXISTS)
        cube.addColumn(axisName, R_RPM_TYPE)
        NCubeManager.addCube(cube.applicationID, cube)
        return cube
    }
}
