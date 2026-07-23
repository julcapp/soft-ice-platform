module.exports = {
  name: 'segmentation',
  status: 'customer_segmentation_core_v1',
  owns: ['segments', 'segment rules', 'customer segment assignment history'],
  ...require('./Segment'), ...require('./SegmentRule'), ...require('./CustomerSegment'),
  ...require('./SegmentationRepository'), ...require('./SegmentationService'),
  ...require('./SegmentationRuntime'), ...require('./segmentationDto'),
};
